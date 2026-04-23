import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "../utils/logger";

const LOG_PREFIX = "[WhatsAppPresence]";

const heartbeatTimers = new Map<number, NodeJS.Timeout>();

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

/** Comportamento antigo: online ao ligar. */
export function shouldMarkOnlineOnConnect(): boolean {
  return getPresenceMode() === "legacy";
}

/** Só no modo `unavailable`: um disparo ao conectar. */
export function shouldSendUnavailableOnConnect(): boolean {
  return getPresenceMode() === "unavailable";
}

/** Só no modo `unavailable`: intervalo periódico. */
export function shouldRunUnavailableHeartbeat(): boolean {
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
  logger.info(
    `${LOG_PREFIX} phase=${meta.phase} mode=${mode} markOnlineOnConnect=${shouldMarkOnlineOnConnect()} sendUnavailableOnConnect=${shouldSendUnavailableOnConnect()} heartbeatEnabled=${shouldRunUnavailableHeartbeat()} intervalMs=${getUnavailablePresenceIntervalMs()} whatsappId=${meta.whatsappId} companyId=${meta.companyId} name=${meta.sessionName ?? "-"}`
  );
}

export async function sendGlobalUnavailablePresence(
  wbot: WASocket,
  meta: { whatsappId: number; companyId: number; sessionName?: string },
  reason: "connect" | "interval"
): Promise<void> {
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
