import Company from "../../models/Company";
import Whatsapp from "../../models/Whatsapp";
import WhatsappEvolutionCredential from "../../models/WhatsappEvolutionCredential";
import { logger } from "../../utils/logger";
import {
  loadEvolutionCentralConfig,
  validateEvolutionCentralConfig
} from "../../modules/whatsapp/providers/evolution/central/evolutionCentralConfig";
import {
  EvolutionHttpError,
  evolutionCentralFetchAllInstances,
  evolutionCentralFetchServerInfo
} from "../../modules/whatsapp/providers/evolution/inbound/evolutionHttpClient";
import { listFromFetch } from "../../modules/whatsapp/providers/evolution/lifecycle/ensureEvolutionInstance";
import { normalizeEvolutionConnectionState } from "../../modules/whatsapp/providers/evolution/lifecycle/mapEvolutionConnectionState";

/**
 * Monitoramento Evolution (Super Admin) — somente leitura.
 * Uma chamada GET /instance/fetchInstances na Evolution central, cruzada com
 * WhatsappEvolutionCredentials → Whatsapps → Companies. Resposta em whitelist:
 * nunca inclui apikey, token de instância, baseUrl, QR ou payload bruto.
 */

export const EVOLUTION_MONITOR_CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

export type EvolutionMonitorState = "connected" | "connecting" | "disconnected";

export type EvolutionMonitorApiStatus = "online" | "offline" | "not_configured";

export type EvolutionMonitorInstance = {
  instanceName: string;
  number: string | null;
  state: EvolutionMonitorState;
  linked: boolean;
  companyId: number | null;
  companyName: string | null;
  whatsappId: number | null;
  whatsappName: string | null;
  lastUpdate: string | null;
};

export type EvolutionMonitorSnapshot = {
  generatedAt: string;
  api: {
    status: EvolutionMonitorApiStatus;
    latencyMs: number | null;
    errorCode: string | null;
    version: string | null;
  };
  indicators: {
    total: number;
    connected: number;
    disconnected: number;
    connecting: number;
    companies: number;
    unlinked: number;
  };
  instances: EvolutionMonitorInstance[];
};

type RemoteInstance = {
  instanceName: string;
  number: string | null;
  state: EvolutionMonitorState;
  updatedAt: string | null;
};

function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "5511999999999@s.whatsapp.net" / "5511999999999:12@..." → dígitos E.164 sem "+". */
export function extractWhatsappNumber(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const [user, server] = raw.split("@");
  // LID, grupo, broadcast e canal têm dígitos que não são telefone.
  if (server !== undefined && !["s.whatsapp.net", "c.us"].includes(server))
    return null;
  const digits = user.split(":")[0].replace(/\D/g, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

/** GET / da Evolution → "2.3.7". Só aceita formato de versão. */
export function extractEvolutionVersion(payload: unknown): string | null {
  const raw = (payload as { version?: unknown } | null)?.version;
  return typeof raw === "string" && /^v?\d+(\.\d+){0,3}[\w.+-]{0,16}$/.test(raw)
    ? raw
    : null;
}

function toMonitorState(raw: unknown): EvolutionMonitorState {
  const state = normalizeEvolutionConnectionState(raw);
  if (state === "open") return "connected";
  if (state === "connecting") return "connecting";
  return "disconnected";
}

/** Aceita formato v2 (flat) e v1 ({ instance: {...} }). Lê só campos whitelist. */
function parseRemoteInstance(
  row: Record<string, unknown>
): RemoteInstance | null {
  const inst =
    row.instance &&
    typeof row.instance === "object" &&
    !Array.isArray(row.instance)
      ? (row.instance as Record<string, unknown>)
      : row;
  const name = String(inst.instanceName || inst.name || "").trim();
  if (!name) return null;
  return {
    instanceName: name,
    number: extractWhatsappNumber(inst.ownerJid ?? inst.owner ?? inst.number),
    state: toMonitorState(inst.connectionStatus ?? inst.status ?? inst.state),
    updatedAt: toIso(inst.updatedAt)
  };
}

async function loadCredentialIndex(): Promise<
  Map<string, WhatsappEvolutionCredential>
> {
  const rows = await WhatsappEvolutionCredential.findAll({
    attributes: ["instanceName", "companyId", "whatsappId"],
    include: [
      { model: Company, attributes: ["id", "name"] },
      { model: Whatsapp, attributes: ["id", "name", "updatedAt"] }
    ]
  });
  return new Map(
    rows.map(row => [
      String(row.instanceName || "")
        .trim()
        .toLowerCase(),
      row
    ])
  );
}

function buildIndicators(
  instances: EvolutionMonitorInstance[]
): EvolutionMonitorSnapshot["indicators"] {
  const companies = new Set<number>();
  const indicators = {
    total: instances.length,
    connected: 0,
    disconnected: 0,
    connecting: 0,
    companies: 0,
    unlinked: 0
  };
  instances.forEach(inst => {
    indicators[inst.state] += 1;
    if (inst.companyId != null) companies.add(inst.companyId);
    else indicators.unlinked += 1;
  });
  indicators.companies = companies.size;
  return indicators;
}

function errorSnapshot(
  status: EvolutionMonitorApiStatus,
  errorCode: string,
  latencyMs: number | null
): EvolutionMonitorSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    api: { status, latencyMs, errorCode, version: null },
    indicators: buildIndicators([]),
    instances: []
  };
}

async function buildSnapshot(): Promise<EvolutionMonitorSnapshot> {
  const config = loadEvolutionCentralConfig();
  if (!config) {
    return errorSnapshot(
      "not_configured",
      "ERR_EVOLUTION_CENTRAL_CONFIG_MISSING",
      null
    );
  }
  try {
    validateEvolutionCentralConfig(config);
  } catch {
    return errorSnapshot(
      "not_configured",
      "ERR_EVOLUTION_CENTRAL_CONFIG_INVALID",
      null
    );
  }

  const central = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    timeoutMs: FETCH_TIMEOUT_MS
  };
  // Versão é informativa: falha aqui não muda o status da API.
  const versionPromise = evolutionCentralFetchServerInfo(central)
    .then(extractEvolutionVersion)
    .catch(() => null);
  const startedAt = Date.now();
  let payload: unknown;
  try {
    payload = await evolutionCentralFetchAllInstances(central);
  } catch (err) {
    const code =
      err instanceof EvolutionHttpError
        ? err.code
        : "ERR_EVOLUTION_REQUEST_FAILED";
    logger.warn({ code }, "[EvolutionMonitor] fetchInstances failed");
    return errorSnapshot("offline", code, Date.now() - startedAt);
  }
  const latencyMs = Date.now() - startedAt;
  const version = await versionPromise;

  const credentials = await loadCredentialIndex();
  const instances: EvolutionMonitorInstance[] = listFromFetch(payload)
    .map(parseRemoteInstance)
    .filter((remote): remote is RemoteInstance => remote !== null)
    .map(remote => {
      const cred = credentials.get(remote.instanceName.toLowerCase());
      const linked = Boolean(cred?.company);
      return {
        instanceName: remote.instanceName,
        number: remote.number,
        state: remote.state,
        linked,
        companyId: linked ? cred.companyId : null,
        companyName: linked ? cred.company.name : null,
        whatsappId: linked ? cred.whatsappId : null,
        whatsappName: linked ? cred.whatsapp?.name || null : null,
        lastUpdate:
          remote.updatedAt || (linked ? toIso(cred.whatsapp?.updatedAt) : null)
      };
    });
  instances.sort(
    (a, b) =>
      Number(!a.linked) - Number(!b.linked) ||
      String(a.companyName || "").localeCompare(String(b.companyName || "")) ||
      a.instanceName.localeCompare(b.instanceName)
  );

  return {
    generatedAt: new Date().toISOString(),
    api: { status: "online", latencyMs, errorCode: null, version },
    indicators: buildIndicators(instances),
    instances
  };
}

let cache: { expiresAt: number; value: EvolutionMonitorSnapshot } | null = null;
let inflight: Promise<EvolutionMonitorSnapshot> | null = null;

/** Snapshot com cache de 60s (inclusive erro) e deduplicação de chamadas concorrentes. */
export async function getEvolutionMonitorSnapshot(): Promise<EvolutionMonitorSnapshot> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  if (inflight) return inflight;
  inflight = buildSnapshot()
    .then(value => {
      cache = { expiresAt: Date.now() + EVOLUTION_MONITOR_CACHE_TTL_MS, value };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetEvolutionMonitorCache(): void {
  cache = null;
  inflight = null;
}
