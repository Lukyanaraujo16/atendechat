import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "../utils/logger";

const LOG_PREFIX = "[WhatsAppPresence]";

const heartbeatTimers = new Map<number, NodeJS.Timeout>();

/** Liga envio periódico de presença global `unavailable` (recomendado para não suprimir push no telefone). */
export function isForceUnavailablePresenceEnabled(): boolean {
  const v = process.env.WHATSAPP_FORCE_UNAVAILABLE_PRESENCE;
  if (v === undefined || v === "") {
    return true;
  }
  return v === "true" || v === "1" || v === "yes";
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

/**
 * Quando forçamos `unavailable`, não marcamos online na ligação (evita janela inicial “online”).
 */
export function shouldMarkOnlineOnConnect(): boolean {
  return !isForceUnavailablePresenceEnabled();
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
      `${LOG_PREFIX} sent presence=unavailable reason=${reason} whatsappId=${meta.whatsappId} companyId=${meta.companyId} name=${meta.sessionName ?? "-"}`
    );
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} error reason=${reason} whatsappId=${meta.whatsappId} companyId=${meta.companyId} err=${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function startUnavailablePresenceHeartbeat(
  wbot: WASocket,
  meta: { whatsappId: number; companyId: number; sessionName?: string }
): void {
  if (!isForceUnavailablePresenceEnabled()) {
    return;
  }
  clearUnavailablePresenceHeartbeat(meta.whatsappId);

  const ms = getUnavailablePresenceIntervalMs();
  const timer = setInterval(() => {
    void sendGlobalUnavailablePresence(wbot, meta, "interval");
  }, ms);

  heartbeatTimers.set(meta.whatsappId, timer);
  logger.info(
    `${LOG_PREFIX} heartbeat started whatsappId=${meta.whatsappId} companyId=${meta.companyId} intervalMs=${ms}`
  );
}

export function clearUnavailablePresenceHeartbeat(whatsappId: number): void {
  const timer = heartbeatTimers.get(whatsappId);
  if (timer === undefined) {
    return;
  }
  clearInterval(timer);
  heartbeatTimers.delete(whatsappId);
  logger.info(`${LOG_PREFIX} heartbeat cleared whatsappId=${whatsappId}`);
}
