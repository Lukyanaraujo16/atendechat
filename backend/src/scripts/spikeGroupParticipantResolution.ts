/**
 * Spike controlado — fase 2: resolução de telefone + diagnóstico estrutural LID.
 *
 * Somente leitura:
 * - groupMetadata / groupFetchAllParticipating
 * - lid-mapping via JSON de sessão
 * - signalRepository.lidMapping.getPNForLID (consulta local ao key store, sem USync)
 *
 * Uso:
 *   npm run build
 *   node dist/scripts/spikeGroupParticipantResolution.js --whatsappId=19 --maxGroups=30
 *   node dist/scripts/spikeGroupParticipantResolution.js --whatsappId=19 --groupJid=120363...@g.us
 *   node dist/scripts/spikeGroupParticipantResolution.js --whatsappId=19 --skipPhase2
 *   node dist/scripts/spikeGroupParticipantResolution.js --whatsappId=19 --skipRuntimeAudit
 */

import "../bootstrap";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type GroupMetadata,
  type GroupParticipant
} from "@whiskeysockets/baileys";
import P from "pino";
import sequelize from "../database";
import authState from "../helpers/authState";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import {
  analyzeSpikeGroups,
  containsFullPhoneInJson,
  extractLidUserFromJid,
  isLidJid,
  loadLidToPnUserMapFromSessionJson,
  maskPhone,
  phoneDigitsFromRuntimePnJid,
  resolveSpikeParticipant,
  wrapReadOnlySignalKeyStore,
  type SpikeGroupInput,
  type SpikeParticipantInput
} from "./lib/groupParticipantResolutionSpike";

type CliOptions = {
  whatsappId: number;
  groupJid?: string;
  maxGroups: number;
  connectTimeoutMs: number;
  includePhase2: boolean;
  skipRuntimeAudit: boolean;
};

type RuntimeLidMappingReader = {
  getPNForLID: (lid: string) => Promise<string | null>;
};

type SpikeSocket = ReturnType<typeof makeWASocket> & {
  signalRepository?: {
    lidMapping?: RuntimeLidMappingReader;
  };
};

function parseArgs(argv: string[]): CliOptions {
  let whatsappId: number | undefined;
  let groupJid: string | undefined;
  let maxGroups = 8;
  let connectTimeoutMs = 90_000;
  let includePhase2 = true;
  let skipRuntimeAudit = false;

  for (const arg of argv) {
    if (arg.startsWith("--whatsappId=")) {
      whatsappId = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--groupJid=")) {
      groupJid = String(arg.split("=")[1] || "").trim();
    } else if (arg.startsWith("--maxGroups=")) {
      maxGroups = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--connectTimeoutMs=")) {
      connectTimeoutMs = Number(arg.split("=")[1]);
    } else if (arg === "--skipPhase2") {
      includePhase2 = false;
    } else if (arg === "--skipRuntimeAudit") {
      skipRuntimeAudit = true;
    }
  }

  if (!whatsappId || !Number.isFinite(whatsappId)) {
    throw new Error("Informe --whatsappId=<number>");
  }

  return {
    whatsappId,
    groupJid: groupJid || undefined,
    maxGroups: Number.isFinite(maxGroups) && maxGroups > 0 ? maxGroups : 8,
    connectTimeoutMs:
      Number.isFinite(connectTimeoutMs) && connectTimeoutMs > 0
        ? connectTimeoutMs
        : 90_000,
    includePhase2,
    skipRuntimeAudit
  };
}

function normalizeGroupJid(input: string): string {
  const s = String(input || "").trim();
  if (s.includes("@g.us")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) throw new Error("groupJid inválido");
  return `${digits}@g.us`;
}

function mapParticipant(participant: GroupParticipant): SpikeParticipantInput {
  const record = participant as unknown as Record<string, unknown>;
  const presentKeys = Object.keys(record).filter(
    key => record[key] !== undefined
  );

  return {
    id: participant.id ?? null,
    phoneNumber: participant.phoneNumber ?? null,
    lid: participant.lid ?? null,
    name: participant.name ?? null,
    notify: participant.notify ?? null,
    verifiedName: participant.verifiedName ?? null,
    imgUrl:
      participant.imgUrl === undefined || participant.imgUrl === null
        ? null
        : String(participant.imgUrl),
    status: participant.status ?? null,
    admin: participant.admin ?? null,
    isAdmin: participant.isAdmin ?? null,
    isSuperAdmin: participant.isSuperAdmin ?? null,
    presentKeys
  };
}

function mapParticipants(meta: GroupMetadata): SpikeGroupInput {
  return {
    groupJid: meta.id,
    subject: meta.subject,
    addressingMode: meta.addressingMode ?? null,
    participants: (meta.participants || []).map(mapParticipant)
  };
}

function pickRepresentativeGroups(
  all: SpikeGroupInput[],
  maxGroups: number
): SpikeGroupInput[] {
  if (all.length <= maxGroups) return all;

  const sorted = [...all].sort(
    (a, b) => a.participants.length - b.participants.length
  );
  const picks: SpikeGroupInput[] = [];
  const used = new Set<string>();

  const push = (g: SpikeGroupInput | undefined) => {
    if (!g || used.has(g.groupJid)) return;
    used.add(g.groupJid);
    picks.push(g);
  };

  push(sorted[0]);
  push(sorted[Math.floor(sorted.length / 2)]);
  push(sorted[sorted.length - 1]);

  const lidGroup = all.find(
    g => String(g.addressingMode).toLowerCase() === "lid"
  );
  push(lidGroup);

  for (const g of sorted) {
    if (picks.length >= maxGroups) break;
    push(g);
  }

  return picks.slice(0, maxGroups);
}

function blockWhatsappPersistence(whatsapp: Whatsapp): void {
  whatsapp.update = (async () => {
    // eslint-disable-next-line no-console
    console.log("Whatsapp.update chamado — bloqueado");
    return whatsapp;
  }) as unknown as typeof whatsapp.update;
}

async function createReadOnlySocket(whatsapp: Whatsapp, connectTimeoutMs: number) {
  const { state } = await authState(whatsapp);
  const { version } = await fetchLatestBaileysVersion();
  const readOnlyKeys = wrapReadOnlySignalKeyStore(
    state.keys as unknown as Parameters<typeof wrapReadOnlySignalKeyStore>[0],
    types => {
      // eslint-disable-next-line no-console
      console.log(`keys.set chamado types=${types.join(",")}`);
    }
  ) as unknown as typeof state.keys;

  return new Promise<SpikeSocket>((resolve, reject) => {
    const sock = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.appropriate("Desktop"),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(readOnlyKeys, logger)
      },
      version,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs,
      shouldIgnoreJid: () => false
    }) as SpikeSocket;

    const timer = setTimeout(() => {
      try {
        sock.ws?.close();
      } catch {
        /* ignore */
      }
      reject(new Error("ERR_SPIKE_CONNECT_TIMEOUT"));
    }, connectTimeoutMs);

    sock.ev.on("creds.update", () => {
      // eslint-disable-next-line no-console
      console.log("creds.update chamado — persistência ignorada");
    });

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        clearTimeout(timer);
        try {
          sock.ws?.close();
        } catch {
          /* ignore */
        }
        reject(new Error("ERR_SPIKE_SESSION_REQUIRES_QR"));
      }

      if (connection === "open") {
        clearTimeout(timer);
        resolve(sock);
        return;
      }

      if (connection === "close") {
        clearTimeout(timer);
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          reject(new Error("ERR_SPIKE_SESSION_LOGGED_OUT"));
          return;
        }
        reject(
          new Error(
            `ERR_SPIKE_CONNECTION_CLOSED status=${String(statusCode ?? "unknown")}`
          )
        );
      }
    });

    // creds.update é observado apenas para log; não chama saveState.
  });
}

function collectUnresolvedLidJids(
  groups: SpikeGroupInput[],
  sessionLidToPn: Map<string, string>
): string[] {
  const jids = new Set<string>();
  for (const group of groups) {
    for (const participant of group.participants) {
      const id = String(participant.id ?? "").trim();
      if (!isLidJid(id)) continue;
      const resolution = resolveSpikeParticipant(participant, sessionLidToPn);
      if (resolution.category === "unresolvedLid") {
        jids.add(id);
      }
    }
  }
  return Array.from(jids);
}

/**
 * Consulta getPNForLID para LIDs ainda não resolvidos pelo metadata/sessão JSON.
 * getPNForLID (Baileys 7) lê cache + keys.get — não dispara USync nem mutações.
 */
async function buildRuntimeLidToPnMap(
  sock: SpikeSocket,
  unresolvedLidJids: string[]
): Promise<Map<string, string>> {
  const runtimeMap = new Map<string, string>();
  const reader = sock.signalRepository?.lidMapping;
  if (!reader?.getPNForLID || unresolvedLidJids.length === 0) {
    return runtimeMap;
  }

  for (const lidJid of unresolvedLidJids) {
    try {
      const pnJid = await reader.getPNForLID(lidJid);
      const digits = phoneDigitsFromRuntimePnJid(pnJid);
      const lidUser = extractLidUserFromJid(lidJid);
      if (lidUser && digits) {
        runtimeMap.set(lidUser, digits);
      }
    } catch {
      /* ignore individual lookup failures */
    }
  }

  return runtimeMap;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const whatsapp = await Whatsapp.findByPk(opts.whatsappId);
  if (!whatsapp) {
    throw new Error(`WhatsApp id=${opts.whatsappId} não encontrado`);
  }

  if (!whatsapp.session) {
    throw new Error(
      "Sessão vazia no banco — conecte a instância antes de rodar o spike."
    );
  }

  const sessionLidToPn = loadLidToPnUserMapFromSessionJson(whatsapp.session);

  // eslint-disable-next-line no-console
  console.log("\n=== Spike fase 2: resolução + diagnóstico LID ===");
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        whatsappId: whatsapp.id,
        companyId: whatsapp.companyId,
        status: whatsapp.status,
        sessionLidMappingEntries: sessionLidToPn.size,
        phase2Enabled: opts.includePhase2,
        runtimeAuditEnabled: opts.includePhase2 && !opts.skipRuntimeAudit,
        mode: opts.groupJid ? "single-group" : "sample-groups",
        maxGroups: opts.maxGroups
      },
      null,
      2
    )
  );

  blockWhatsappPersistence(whatsapp);
  const sock = await createReadOnlySocket(whatsapp, opts.connectTimeoutMs);

  try {
    let groupsToAnalyze: SpikeGroupInput[] = [];

    if (opts.groupJid) {
      const jid = normalizeGroupJid(opts.groupJid);
      const meta = await sock.groupMetadata(jid);
      groupsToAnalyze = [mapParticipants(meta)];
    } else {
      const all = await sock.groupFetchAllParticipating();
      const mapped = Object.values(all || {}).map(mapParticipants);
      groupsToAnalyze = pickRepresentativeGroups(mapped, opts.maxGroups);
    }

    let runtimeLidToPn = new Map<string, string>();
    if (opts.includePhase2 && !opts.skipRuntimeAudit) {
      const unresolvedLidJids = collectUnresolvedLidJids(
        groupsToAnalyze,
        sessionLidToPn
      );
      runtimeLidToPn = await buildRuntimeLidToPnMap(sock, unresolvedLidJids);
    }

    const aggregate = analyzeSpikeGroups(groupsToAnalyze, sessionLidToPn, {
      runtimeLidToPn,
      sessionJson: whatsapp.session,
      includePhase2: opts.includePhase2
    });

    const output = {
      groupsAnalyzed: aggregate.groupsAnalyzed,
      totalParticipants: aggregate.totalParticipants,
      resolutionPercentage: aggregate.resolutionPercentage,
      withPhoneNumberField: aggregate.withPhoneNumberField,
      pctWithPhoneNumberField: aggregate.pctWithPhoneNumberField,
      withPnId: aggregate.withPnId,
      pctWithPnId: aggregate.pctWithPnId,
      lidWithPnField: aggregate.lidWithPnField,
      pctLidWithPnField: aggregate.pctLidWithPnField,
      lidResolvedByMapping: aggregate.lidResolvedByMapping,
      pctLidResolvedByMapping: aggregate.pctLidResolvedByMapping,
      lidResolvedByRuntimeKeyStore: aggregate.lidResolvedByRuntimeKeyStore,
      pctLidResolvedByRuntimeKeyStore: aggregate.pctLidResolvedByRuntimeKeyStore,
      unresolvedLid: aggregate.unresolvedLid,
      pctUnresolvedLid: aggregate.pctUnresolvedLid,
      invalidPhone: aggregate.invalidPhone,
      pctInvalidPhone: aggregate.pctInvalidPhone,
      uniqueResolvedPhones: aggregate.uniqueResolvedPhones,
      byAddressingMode: aggregate.byAddressingMode,
      phase2: aggregate.phase2,
      sampleGroups: aggregate.groups.map(g => ({
        groupJidMasked: g.groupJidMasked,
        addressingMode: g.addressingMode,
        totalParticipants: g.totalParticipants,
        resolutionPercentage: g.resolutionPercentage,
        unresolvedLid: g.unresolvedLid,
        lidResolvedByRuntimeKeyStore: g.lidResolvedByRuntimeKeyStore
      })),
      maskedPhoneExample: maskPhone("5511999887766")
    };

    if (containsFullPhoneInJson(output)) {
      throw new Error("ERR_SPIKE_PII_GUARD: saída contém telefone completo");
    }

    // eslint-disable-next-line no-console
    console.log("\n=== Resultado agregado (sem PII) ===");
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output, null, 2));
  } finally {
    try {
      sock.ws?.close();
    } catch {
      /* ignore */
    }
  }

  await sequelize.close();
}

main().catch(async err => {
  // eslint-disable-next-line no-console
  console.error("\n=== Spike falhou ===");
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  try {
    await sequelize.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
