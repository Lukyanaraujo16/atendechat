/**
 * Mapeia status Evolution → ack numérico StreamHub/Baileys (0–5).
 *
 * Fonte: Evolution API MESSAGES_UPDATE (`status[update.status]` textual)
 * + enum Baileys WebMessageInfo.Status alinhado ao frontend.
 *
 * | Evolution              | ack |
 * |------------------------|-----|
 * | ERROR / FAILED         | 0   |
 * | PENDING                | 1   |
 * | SERVER_ACK             | 2   |
 * | DELIVERY_ACK           | 3   |
 * | READ                   | 4   |
 * | PLAYED                 | 5   |
 */

export const STREAMHUB_ACK = {
  ERROR: 0,
  PENDING: 1,
  SERVER_ACK: 2,
  DELIVERY_ACK: 3,
  READ: 4,
  PLAYED: 5
} as const;

/**
 * Regra monotônica + falha tardia:
 * - status avançado nunca regride (ex.: READ → DELIVERY_ACK → mantém READ);
 * - ERROR (0) só aplica se o ack atual ainda for pending/error (< SERVER_ACK).
 */
export function shouldApplyAck(
  currentAck: number,
  incomingAck: number
): boolean {
  const current = Number.isFinite(currentAck) ? currentAck : 0;
  if (incomingAck === STREAMHUB_ACK.ERROR) {
    return current < STREAMHUB_ACK.SERVER_ACK;
  }
  return incomingAck > current;
}

export function mapEvolutionStatusToAck(status: unknown): number | null {
  if (status == null) return null;

  if (typeof status === "number" && Number.isFinite(status)) {
    const n = Math.trunc(status);
    if (n >= 0 && n <= 5) return n;
    return null;
  }

  const raw = String(status).trim().toUpperCase();
  if (!raw) return null;

  switch (raw) {
    case "ERROR":
    case "FAILED":
      return STREAMHUB_ACK.ERROR;
    case "PENDING":
      return STREAMHUB_ACK.PENDING;
    case "SERVER_ACK":
    case "SERVER":
    case "SENT":
      return STREAMHUB_ACK.SERVER_ACK;
    case "DELIVERY_ACK":
    case "DELIVERED":
    case "DELIVERY":
      return STREAMHUB_ACK.DELIVERY_ACK;
    case "READ":
      return STREAMHUB_ACK.READ;
    case "PLAYED":
      return STREAMHUB_ACK.PLAYED;
    default:
      return null;
  }
}
