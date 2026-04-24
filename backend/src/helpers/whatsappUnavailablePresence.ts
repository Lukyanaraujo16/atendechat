import type { WASocket } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

const LOG_PREFIX = "[WhatsAppPresence]";
const STARTUP_PREFIX = "[WhatsAppStartup]";

const heartbeatTimers = new Map<number, NodeJS.Timeout>();

/**
 * Diagnóstico extremo: não chamar readMessages/sendReceipts (ver SetTicketMessagesAsRead),
 * não enviar presença (unavailable/composing/…) — ver typebot, typeSimulation, sendGlobalUnavailablePresence.
 * `markOnlineOnConnect` forçado para `true` para aproximar sessão “antiga”.
 */
export function isWhatsAppDisableAllReadAndPresenceSideEffects(): boolean {
  return process.env.WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE_SIDE_EFFECTS === "true";
}

function readBackendPackageVersion(): string {
  const candidates = [
    path.join(__dirname, "..", "..", "package.json"),
    path.join(process.cwd(), "package.json")
  ];
  for (const p of candidates) {
    try {
      const v = JSON.parse(fs.readFileSync(p, "utf8")) as { version?: string };
      if (v?.version) return v.version;
    } catch {
      /* next */
    }
  }
  return "unknown";
}

/** Uma linha inequívoca no arranque: provar build/env em produção. */
export function logWhatsAppPolicyAtProcessBoot(): void {
  const version = readBackendPackageVersion();
  const buildStamp = process.env.BACKEND_BUILD_STAMP || process.env.GIT_SHA || "(unset)";
  const modeRaw = process.env.WHATSAPP_PRESENCE_MODE ?? "(unset)";
  const forceOld = process.env.WHATSAPP_FORCE_UNAVAILABLE_PRESENCE ?? "(unset)";
  const intervalRaw =
    process.env.WHATSAPP_UNAVAILABLE_PRESENCE_INTERVAL_MS ?? "(unset)";
  const diag = isWhatsAppDisableAllReadAndPresenceSideEffects();

  logger.info(
    `${STARTUP_PREFIX} backendPackageVersion=${version} buildStamp=${buildStamp} cwd=${process.cwd()} NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}`
  );
  logger.info(
    `${STARTUP_PREFIX} env_raw WHATSAPP_PRESENCE_MODE=${modeRaw} WHATSAPP_FORCE_UNAVAILABLE_PRESENCE=${forceOld} WHATSAPP_UNAVAILABLE_PRESENCE_INTERVAL_MS=${intervalRaw}`
  );
  logger.info(
    `${STARTUP_PREFIX} env_raw WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE_SIDE_EFFECTS=${diag} WHATSAPP_TRACE_INBOUND=${process.env.WHATSAPP_TRACE_INBOUND ?? "(unset)"} WHATSAPP_READ_RECEIPT_PEER_VISIBLE=${process.env.WHATSAPP_READ_RECEIPT_PEER_VISIBLE ?? "(unset)"} WHATSAPP_READ_RECEIPT_RESPECT_PRIVACY=${process.env.WHATSAPP_READ_RECEIPT_RESPECT_PRIVACY ?? "(unset)"}`
  );

  const mode = getPresenceMode();
  logger.info(
    `${STARTUP_PREFIX} effective presenceMode=${mode} markOnlineOnConnect=${shouldMarkOnlineOnConnect()} sendUnavailableOnConnect=${shouldSendUnavailableOnConnect()} heartbeatEnabled=${shouldRunUnavailableHeartbeat()} intervalMs=${getUnavailablePresenceIntervalMs()} diagnosticSuppress=${diag}`
  );
}

export type WhatsAppPresenceMode = "legacy" | "unavailable" | "passive";

/**
 * - legacy: igual ao comportamento antigo do projeto (`markOnlineOnConnect: true`, sem unavailable global nem heartbeat).
 * - unavailable: `markOnlineOnConnect: false` + `sendPresenceUpdate("unavailable")` ao abrir + heartbeat periódico.
 * - passive: `markOnlineOnConnect: false`, sem envio global de unavailable nem heartbeat (útil para testes A/B).
 *
 * Omissão ou valor inválido → legacy (maximiza chance de recuperar push como antes).
 *
 * Compat: `WHATSAPP_FORCE_UNAVAILABLE_PRESENCE=true` mapeia para `unavailable`; `false` para `legacy`, se `WHATSAPP_PRESENCE_MODE` não estiver definido.
 */
export function getPresenceMode(): WhatsAppPresenceMode {
  const raw = (process.env.WHATSAPP_PRESENCE_MODE || "").trim().toLowerCase();
  if (raw === "legacy" || raw === "unavailable" || raw === "passive") {
    return raw;
  }

  const legacyForce = process.env.WHATSAPP_FORCE_UNAVAILABLE_PRESENCE;
  if (legacyForce === "true" || legacyForce === "1" || legacyForce === "yes") {
    return "unavailable";
  }
  if (
    legacyForce === "false" ||
    legacyForce === "0" ||
    legacyForce === "no"
  ) {
    return "legacy";
  }

  return "legacy";
}

/** Comportamento antigo: online ao ligar (`legacy`). Em diagnóstico, força `true`. */
export function shouldMarkOnlineOnConnect(): boolean {
  if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
    return true;
  }
  return getPresenceMode() === "legacy";
}

/** Só no modo `unavailable`: um disparo ao conectar. */
export function shouldSendUnavailableOnConnect(): boolean {
  if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
    return false;
  }
  return getPresenceMode() === "unavailable";
}

/** Só no modo `unavailable`: intervalo periódico. */
export function shouldRunUnavailableHeartbeat(): boolean {
  if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
    return false;
  }
  return getPresenceMode() === "unavailable";
}

/** Intervalo mínimo 10s para evitar spam ao servidor. */
export function getUnavailablePresenceIntervalMs(): number {
  const raw = process.env.WHATSAPP_UNAVAILABLE_PRESENCE_INTERVAL_MS;
  if (!raw || raw === "") {
    return 60_000;
  }
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 10_000) {
    return 60_000;
  }
  return n;
}

/** Log da política efetiva (comparar com logs em produção). */
export function logWhatsAppPresenceSocketConfig(meta: {
  whatsappId: number;
  companyId: number;
  sessionName?: string;
  phase: "makeWASocket" | "connection_open";
}): void {
  const mode = getPresenceMode();
  const pkgV = readBackendPackageVersion();
  logger.info(
    `${LOG_PREFIX} phase=${meta.phase} backendPackageVersion=${pkgV} WHATSAPP_PRESENCE_MODE_raw=${process.env.WHATSAPP_PRESENCE_MODE ?? "(unset)"} mode_effective=${mode} markOnlineOnConnect_effective=${shouldMarkOnlineOnConnect()} sendUnavailableOnConnect=${shouldSendUnavailableOnConnect()} heartbeatEnabled=${shouldRunUnavailableHeartbeat()} intervalMs=${getUnavailablePresenceIntervalMs()} diagnosticSuppress=${isWhatsAppDisableAllReadAndPresenceSideEffects()} whatsappId=${meta.whatsappId} companyId=${meta.companyId} name=${meta.sessionName ?? "-"}`
  );
}

export async function sendGlobalUnavailablePresence(
  wbot: WASocket,
  meta: { whatsappId: number; companyId: number; sessionName?: string },
  reason: "connect" | "interval"
): Promise<void> {
  if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
    logger.info(
      `${LOG_PREFIX} skip presence=unavailable reason=${reason} cause=WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE_SIDE_EFFECTS whatsappId=${meta.whatsappId}`
    );
    return;
  }
  try {
    if (typeof wbot.sendPresenceUpdate !== "function") {
      logger.warn(
        `${LOG_PREFIX} skip sendPresenceUpdate missing whatsappId=${meta.whatsappId} companyId=${meta.companyId}`
      );
      return;
    }
    await wbot.sendPresenceUpdate("unavailable");
    logger.info(
      `${LOG_PREFIX} sent presence=unavailable reason=${reason} mode=${getPresenceMode()} whatsappId=${meta.whatsappId} companyId=${meta.companyId} name=${meta.sessionName ?? "-"}`
    );
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} error reason=${reason} mode=${getPresenceMode()} whatsappId=${meta.whatsappId} companyId=${meta.companyId} err=${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function startUnavailablePresenceHeartbeat(
  wbot: WASocket,
  meta: { whatsappId: number; companyId: number; sessionName?: string }
): void {
  if (!shouldRunUnavailableHeartbeat()) {
    return;
  }
  clearUnavailablePresenceHeartbeat(meta.whatsappId);

  const ms = getUnavailablePresenceIntervalMs();
  const timer = setInterval(() => {
    void sendGlobalUnavailablePresence(wbot, meta, "interval");
  }, ms);

  heartbeatTimers.set(meta.whatsappId, timer);
  logger.info(
    `${LOG_PREFIX} heartbeat started mode=${getPresenceMode()} whatsappId=${meta.whatsappId} companyId=${meta.companyId} intervalMs=${ms}`
  );
}

export function clearUnavailablePresenceHeartbeat(whatsappId: number): void {
  const timer = heartbeatTimers.get(whatsappId);
  if (timer === undefined) {
    return;
  }
  clearInterval(timer);
  heartbeatTimers.delete(whatsappId);
  logger.info(
    `${LOG_PREFIX} heartbeat cleared whatsappId=${whatsappId} mode=${getPresenceMode()}`
  );
}
