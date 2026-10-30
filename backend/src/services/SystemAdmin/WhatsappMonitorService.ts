import { literal } from "sequelize";
import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
import { getWbot } from "../../libs/wbot";
import { logger } from "../../utils/logger";
import {
  WhatsAppConnectionProvider,
  WhatsAppConnectionProviderValue
} from "../../modules/whatsapp/connectionProvider";
import {
  EvolutionMonitorApiStatus,
  EvolutionMonitorSnapshot,
  extractWhatsappNumber,
  getEvolutionMonitorSnapshot
} from "./EvolutionMonitorService";

/**
 * Central de Monitoramento WhatsApp (Super Admin) — somente leitura.
 * Base: tabela Whatsapps (uma linha = uma conexão). Baileys é enriquecido com o
 * socket em memória (getWbot, sem iniciar/reconectar nada); Evolution com o
 * snapshot já cacheado do EvolutionMonitorService. Instâncias Evolution sem
 * conexão cadastrada são órfãs: contadas à parte, nunca como conexão de empresa.
 * Resposta em whitelist: sem session, QR, token ou credenciais.
 */

export const WHATSAPP_MONITOR_CACHE_TTL_MS = 15_000;
export const WHATSAPP_MONITOR_MAX_PAGE_SIZE = 100;
// Evolution lenta/offline não segura a visão Baileys; o snapshot segue cacheando em segundo plano.
export const EVOLUTION_SNAPSHOT_WAIT_MS = 4_000;

export type WhatsappMonitorStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "unconfirmed";

export type WhatsappMonitorStatusSource =
  | "memory"
  | "evolution_api"
  | "database";

export const WHATSAPP_MONITOR_STATUSES: readonly WhatsappMonitorStatus[] = [
  "connected",
  "connecting",
  "disconnected",
  "unconfirmed"
];

export const WHATSAPP_MONITOR_SORT_FIELDS = [
  "company",
  "name",
  "provider",
  "number",
  "status",
  "lastUpdate",
  "whatsappId"
] as const;

export type WhatsappMonitorSortField =
  (typeof WHATSAPP_MONITOR_SORT_FIELDS)[number];

export type WhatsappMonitorConnection = {
  whatsappId: number;
  name: string;
  provider: WhatsAppConnectionProviderValue;
  companyId: number | null;
  companyName: string | null;
  companyActive: boolean | null;
  number: string | null;
  status: WhatsappMonitorStatus;
  statusSource: WhatsappMonitorStatusSource;
  persistedStatus: string | null;
  lastUpdate: string | null;
};

type Counters = Record<WhatsappMonitorStatus, number> & {
  total: number;
  companies: number;
  companiesWithActive: number;
};

export type WhatsappMonitorSummary = Counters & {
  byProvider: Record<WhatsAppConnectionProviderValue, Counters>;
  evolution: {
    apiStatus: EvolutionMonitorApiStatus | "error";
    errorCode: string | null;
    remoteInstances: number;
    orphans: number;
  };
};

export type WhatsappMonitorDataset = {
  generatedAt: string;
  connections: WhatsappMonitorConnection[];
  summary: WhatsappMonitorSummary;
};

export type WhatsappMonitorQuery = {
  provider?: WhatsAppConnectionProviderValue;
  status?: WhatsappMonitorStatus;
  companyId?: number;
  search?: string;
  page: number;
  pageSize: number;
  sortBy: WhatsappMonitorSortField;
  sortDir: "asc" | "desc";
};

type LiveSession = { open: boolean; number: string | null };

/**
 * Lê o socket Baileys já registrado em memória. Só leitura de propriedades:
 * nunca inicia, reconecta ou encerra sessão. Sem socket → null.
 */
export function probeBaileysSession(whatsappId: number): LiveSession | null {
  let wbot: ReturnType<typeof getWbot>;
  try {
    wbot = getWbot(whatsappId);
  } catch {
    return null;
  }
  try {
    const jid = wbot.user?.id;
    return {
      open: Boolean(jid) && Boolean(wbot.ws?.isOpen),
      number: extractWhatsappNumber(jid)
    };
  } catch {
    return { open: false, number: null };
  }
}

/** Status persistido em Whatsapps.status → status do painel (sem confirmação ao vivo). */
export function mapPersistedStatus(
  persisted: string | null | undefined
): WhatsappMonitorStatus {
  switch (
    String(persisted || "")
      .trim()
      .toUpperCase()
  ) {
    case "QRCODE":
    case "OPENING":
      return "connecting";
    case "DISCONNECTED":
    case "PENDING":
      return "disconnected";
    // CONNECTED sem confirmação ao vivo (ou valor desconhecido) não é afirmado.
    default:
      return "unconfirmed";
  }
}

export function resolveBaileysStatus(
  persisted: string | null | undefined,
  live: LiveSession | null
): { status: WhatsappMonitorStatus; source: WhatsappMonitorStatusSource } {
  if (live?.open) return { status: "connected", source: "memory" };
  return { status: mapPersistedStatus(persisted), source: "database" };
}

export function resolveEvolutionStatus(
  persisted: string | null | undefined,
  remoteState: WhatsappMonitorStatus | null
): { status: WhatsappMonitorStatus; source: WhatsappMonitorStatusSource } {
  if (remoteState) return { status: remoteState, source: "evolution_api" };
  return { status: mapPersistedStatus(persisted), source: "database" };
}

function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveProvider(raw: unknown): WhatsAppConnectionProviderValue {
  return String(raw || "")
    .trim()
    .toLowerCase() === WhatsAppConnectionProvider.EVOLUTION
    ? WhatsAppConnectionProvider.EVOLUTION
    : WhatsAppConnectionProvider.BAILEYS;
}

function emptyCounters(): Counters {
  return {
    total: 0,
    connected: 0,
    connecting: 0,
    disconnected: 0,
    unconfirmed: 0,
    companies: 0,
    companiesWithActive: 0
  };
}

function countConnections(rows: WhatsappMonitorConnection[]): Counters {
  const counters = emptyCounters();
  const companies = new Set<number>();
  const active = new Set<number>();
  rows.forEach(row => {
    counters.total += 1;
    counters[row.status] += 1;
    if (row.companyId == null) return;
    companies.add(row.companyId);
    if (row.status === "connected") active.add(row.companyId);
  });
  counters.companies = companies.size;
  counters.companiesWithActive = active.size;
  return counters;
}

export function buildSummary(
  connections: WhatsappMonitorConnection[],
  evolution: WhatsappMonitorSummary["evolution"]
): WhatsappMonitorSummary {
  return {
    ...countConnections(connections),
    byProvider: {
      baileys: countConnections(
        connections.filter(c => c.provider === WhatsAppConnectionProvider.BAILEYS)
      ),
      evolution: countConnections(
        connections.filter(
          c => c.provider === WhatsAppConnectionProvider.EVOLUTION
        )
      )
    },
    evolution
  };
}

// Só o JID próprio (creds.me.id) é extraído do JSON de sessão, no próprio banco:
// chaves e credenciais nunca chegam à aplicação.
const SESSION_JID_ATTRIBUTE = literal(
  `substring("Whatsapp"."session" from '"me":\\{[^}]*"id":"([^"]+)"')`
);

async function loadWhatsappRows(): Promise<Whatsapp[]> {
  return Whatsapp.findAll({
    attributes: [
      "id",
      "name",
      "status",
      "connectionProvider",
      "companyId",
      "updatedAt",
      [SESSION_JID_ATTRIBUTE, "sessionJid"]
    ],
    include: [
      { model: Company, attributes: ["id", "name", "status"], required: false }
    ],
    order: [["id", "ASC"]]
  });
}

async function loadEvolutionSnapshot(): Promise<EvolutionMonitorSnapshot | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      getEvolutionMonitorSnapshot(),
      new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), EVOLUTION_SNAPSHOT_WAIT_MS);
      })
    ]);
  } catch (err) {
    logger.warn(
      { code: (err as { code?: string })?.code || "ERR_EVOLUTION_SNAPSHOT" },
      "[WhatsappMonitor] evolution snapshot failed"
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buildDataset(): Promise<WhatsappMonitorDataset> {
  const [rows, snapshot] = await Promise.all([
    loadWhatsappRows(),
    loadEvolutionSnapshot()
  ]);

  const remoteByWhatsappId = new Map(
    (snapshot?.instances || [])
      .filter(inst => inst.whatsappId != null)
      .map(inst => [inst.whatsappId, inst])
  );
  const knownIds = new Set<number>();

  const connections: WhatsappMonitorConnection[] = rows.map(row => {
    knownIds.add(row.id);
    const provider = resolveProvider(row.connectionProvider);
    const sessionNumber = extractWhatsappNumber(row.get("sessionJid"));
    const base = {
      whatsappId: row.id,
      name: row.name || "",
      provider,
      companyId: row.company ? row.companyId : null,
      companyName: row.company?.name ?? null,
      companyActive: row.company ? row.company.status !== false : null,
      persistedStatus: row.status || null
    };

    if (provider === WhatsAppConnectionProvider.EVOLUTION) {
      const remote = remoteByWhatsappId.get(row.id);
      const { status, source } = resolveEvolutionStatus(
        row.status,
        remote?.state ?? null
      );
      return {
        ...base,
        number: remote?.number ?? sessionNumber,
        status,
        statusSource: source,
        lastUpdate: remote?.lastUpdate ?? toIso(row.updatedAt)
      };
    }

    const live = probeBaileysSession(row.id);
    const { status, source } = resolveBaileysStatus(row.status, live);
    return {
      ...base,
      number: live?.number ?? sessionNumber,
      status,
      statusSource: source,
      lastUpdate: toIso(row.updatedAt)
    };
  });

  const remoteInstances = snapshot?.instances || [];
  return {
    generatedAt: new Date().toISOString(),
    connections,
    summary: buildSummary(connections, {
      apiStatus: snapshot ? snapshot.api.status : "error",
      errorCode: snapshot ? snapshot.api.errorCode : "ERR_EVOLUTION_SNAPSHOT",
      remoteInstances: remoteInstances.length,
      // Órfã: sem credencial vinculada ou apontando para conexão inexistente.
      orphans: remoteInstances.filter(
        inst => inst.whatsappId == null || !knownIds.has(inst.whatsappId)
      ).length
    })
  };
}

const STATUS_ORDER: Record<WhatsappMonitorStatus, number> = {
  connected: 0,
  connecting: 1,
  unconfirmed: 2,
  disconnected: 3
};

function sortValue(
  row: WhatsappMonitorConnection,
  field: WhatsappMonitorSortField
): string | number {
  switch (field) {
    case "company":
      return row.companyName || "";
    case "name":
      return row.name;
    case "provider":
      return row.provider;
    case "number":
      return row.number || "";
    case "status":
      return STATUS_ORDER[row.status];
    case "lastUpdate":
      return row.lastUpdate || "";
    default:
      return row.whatsappId;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
}

export function filterAndPaginate(
  connections: WhatsappMonitorConnection[],
  query: WhatsappMonitorQuery
): {
  rows: WhatsappMonitorConnection[];
  total: number;
  page: number;
  pageSize: number;
} {
  const term = String(query.search || "")
    .trim()
    .toLowerCase();
  const digits = term.replace(/\D/g, "");
  const filtered = connections.filter(row => {
    if (query.provider && row.provider !== query.provider) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.companyId != null && row.companyId !== query.companyId)
      return false;
    if (!term) return true;
    if (row.name.toLowerCase().includes(term)) return true;
    return Boolean(digits && row.number && row.number.includes(digits));
  });

  const dir = query.sortDir === "desc" ? -1 : 1;
  filtered.sort(
    (a, b) =>
      dir * compare(sortValue(a, query.sortBy), sortValue(b, query.sortBy)) ||
      compare(a.companyName || "", b.companyName || "") ||
      a.whatsappId - b.whatsappId
  );

  const pageSize = Math.min(
    Math.max(1, Math.trunc(query.pageSize) || 25),
    WHATSAPP_MONITOR_MAX_PAGE_SIZE
  );
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(query.page) || 1), lastPage);
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize
  };
}

let cache: { expiresAt: number; value: WhatsappMonitorDataset } | null = null;
let inflight: Promise<WhatsappMonitorDataset> | null = null;

/** Dataset com cache curto e deduplicação: filtros/paginação não reconsultam o banco. */
export async function getWhatsappMonitorDataset(): Promise<WhatsappMonitorDataset> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  if (inflight) return inflight;
  inflight = buildDataset()
    .then(value => {
      cache = { expiresAt: Date.now() + WHATSAPP_MONITOR_CACHE_TTL_MS, value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function getWhatsappMonitor(query: WhatsappMonitorQuery): Promise<{
  generatedAt: string;
  summary: WhatsappMonitorSummary;
  companies: { id: number; name: string }[];
  connections: ReturnType<typeof filterAndPaginate>;
}> {
  const dataset = await getWhatsappMonitorDataset();
  const companies = new Map<number, string>();
  dataset.connections.forEach(row => {
    if (row.companyId == null) return;
    if (query.provider && row.provider !== query.provider) return;
    companies.set(row.companyId, row.companyName || "");
  });
  return {
    generatedAt: dataset.generatedAt,
    summary: dataset.summary,
    companies: [...companies.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => compare(a.name, b.name)),
    connections: filterAndPaginate(dataset.connections, query)
  };
}

export function resetWhatsappMonitorCache(): void {
  cache = null;
  inflight = null;
}
