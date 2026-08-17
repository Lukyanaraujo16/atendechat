/**
 * Spike controlado: taxa de resolução de telefone em participantes de grupos WhatsApp.
 *
 * Somente leitura:
 * - groupMetadata / groupFetchAllParticipating
 * - lid-mapping persistido na sessão (leitura via JSON, sem mutar authState)
 *
 * Uso:
 *   npm run build
 *   node dist/scripts/spikeGroupParticipantResolution.js --whatsappId=1
 *   node dist/scripts/spikeGroupParticipantResolution.js --whatsappId=1 --groupJid=120363...@g.us
 *   node dist/scripts/spikeGroupParticipantResolution.js --whatsappId=1 --maxGroups=5
 *
 * Requer: backend/.env com DB + sessão WhatsApp CONNECTED (campo session preenchido).
 * Não registra creds.update — não persiste alterações de sessão durante o spike.
 */

import "../bootstrap";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type GroupMetadata
} from "@whiskeysockets/baileys";
import P from "pino";
import sequelize from "../database";
import authState from "../helpers/authState";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import {
  analyzeSpikeGroups,
  loadLidToPnUserMapFromSessionJson,
  maskPhone,
  type SpikeGroupInput
} from "./lib/groupParticipantResolutionSpike";

type CliOptions = {
  whatsappId: number;
  groupJid?: string;
  maxGroups: number;
  connectTimeoutMs: number;
};

function parseArgs(argv: string[]): CliOptions {
  let whatsappId: number | undefined;
  let groupJid: string | undefined;
  let maxGroups = 8;
  let connectTimeoutMs = 90_000;

  for (const arg of argv) {
    if (arg.startsWith("--whatsappId=")) {
      whatsappId = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--groupJid=")) {
      groupJid = String(arg.split("=")[1] || "").trim();
    } else if (arg.startsWith("--maxGroups=")) {
      maxGroups = Number(arg.split("=")[1]);
    } else if (arg.startsWith("--connectTimeoutMs=")) {
      connectTimeoutMs = Number(arg.split("=")[1]);
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
        : 90_000
  };
}

function normalizeGroupJid(input: string): string {
  const s = String(input || "").trim();
  if (s.includes("@g.us")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) throw new Error("groupJid inválido");
  return `${digits}@g.us`;
}

function mapParticipants(meta: GroupMetadata): SpikeGroupInput {
  return {
    groupJid: meta.id,
    subject: meta.subject,
    addressingMode: meta.addressingMode ?? null,
    participants: (meta.participants || []).map(p => ({
      id: p.id,
      phoneNumber: (p as { phoneNumber?: string }).phoneNumber ?? null,
      lid: (p as { lid?: string }).lid ?? null
    }))
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

  const lidGroup = all.find(g => String(g.addressingMode).toLowerCase() === "lid");
  push(lidGroup);

  for (const g of sorted) {
    if (picks.length >= maxGroups) break;
    push(g);
  }

  return picks.slice(0, maxGroups);
}

async function createReadOnlySocket(whatsapp: Whatsapp, connectTimeoutMs: number) {
  const { state } = await authState(whatsapp);
  const { version } = await fetchLatestBaileysVersion();

  return new Promise<ReturnType<typeof makeWASocket>>((resolve, reject) => {
    const sock = makeWASocket({
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.appropriate("Desktop"),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      version,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs,
      shouldIgnoreJid: () => false
    });

    const timer = setTimeout(() => {
      try {
        sock.ws?.close();
      } catch {
        /* ignore */
      }
      reject(new Error("ERR_SPIKE_CONNECT_TIMEOUT"));
    }, connectTimeoutMs);

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

    // Deliberadamente SEM creds.update → não persiste mutações de sessão durante o spike.
  });
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

  const lidToPnUser = loadLidToPnUserMapFromSessionJson(whatsapp.session);

  // eslint-disable-next-line no-console
  console.log("\n=== Spike: resolução de participantes de grupo ===");
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        whatsappId: whatsapp.id,
        companyId: whatsapp.companyId,
        status: whatsapp.status,
        lidMappingEntries: lidToPnUser.size,
        mode: opts.groupJid ? "single-group" : "sample-groups",
        maxGroups: opts.maxGroups
      },
      null,
      2
    )
  );

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

    const aggregate = analyzeSpikeGroups(groupsToAnalyze, lidToPnUser);

    const exampleResolved = aggregate.groups.find(
      g =>
        g.withPhoneNumberField +
          g.withPnId +
          g.lidWithPnField +
          g.lidResolvedByMapping >
        0
    );

    // eslint-disable-next-line no-console
    console.log("\n=== Resultado agregado (sem PII) ===");
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
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
          unresolvedLid: aggregate.unresolvedLid,
          pctUnresolvedLid: aggregate.pctUnresolvedLid,
          invalidPhone: aggregate.invalidPhone,
          pctInvalidPhone: aggregate.pctInvalidPhone,
          uniqueResolvedPhones: aggregate.uniqueResolvedPhones,
          byAddressingMode: aggregate.byAddressingMode,
          sampleGroups: aggregate.groups.map(g => ({
            groupJidMasked: g.groupJidMasked,
            addressingMode: g.addressingMode,
            totalParticipants: g.totalParticipants,
            resolutionPercentage: g.resolutionPercentage,
            unresolvedLid: g.unresolvedLid
          })),
          maskedPhoneExample: exampleResolved ? maskPhone("5511999887766") : null
        },
        null,
        2
      )
    );
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
