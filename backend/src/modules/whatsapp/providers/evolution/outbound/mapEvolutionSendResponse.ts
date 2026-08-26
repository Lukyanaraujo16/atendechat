import { WhatsAppOutboundSendResult } from "../../../outbound/WhatsAppOutbound";

/**
 * Normaliza resposta Evolution send* → WhatsAppOutboundSendResult.
 * rawSentMessage = envelope provider-aware (NÃO proto Baileys).
 * Mantém key.id para callers legados que leem .key.id.
 */
export function mapEvolutionSendResponseToResult(
  data: unknown,
  fallbackJid: string
): WhatsAppOutboundSendResult {
  const root =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const key =
    root.key && typeof root.key === "object"
      ? (root.key as Record<string, unknown>)
      : {};

  let messageId: string | null = null;
  if (key.id != null && String(key.id).trim()) {
    messageId = String(key.id).trim();
  } else if (typeof root.messageId === "string" && root.messageId.trim()) {
    messageId = root.messageId.trim();
  }

  const remoteJid =
    key.remoteJid != null && String(key.remoteJid).trim()
      ? String(key.remoteJid).trim()
      : fallbackJid || null;

  const fromMe = key.fromMe != null ? Boolean(key.fromMe) : true;

  let status: number | null = null;
  if (typeof root.status === "number") {
    status = root.status;
  } else if (root.status === "PENDING" || root.status === "SERVER_ACK") {
    status = 1;
  } else if (root.status === "DELIVERY_ACK") {
    status = 2;
  } else if (root.status === "READ" || root.status === "PLAYED") {
    status = 3;
  }

  const rawSentMessage = {
    provider: "evolution",
    key: {
      id: messageId,
      remoteJid,
      fromMe
    },
    messageTimestamp:
      root.messageTimestamp != null ? root.messageTimestamp : null,
    status: root.status != null ? root.status : "PENDING",
    messageId,
    remoteJid,
    fromMe
  };

  return {
    messageId,
    remoteJid,
    fromMe,
    status,
    rawSentMessage
  };
}

/** dataJson Evolution outbound sanitizado (sem apikey/base64). */
export function buildEvolutionOutboundDataJson(
  result: WhatsAppOutboundSendResult
): string {
  return JSON.stringify({
    provider: "evolution",
    payload: {
      key: {
        id: result.messageId,
        remoteJid: result.remoteJid,
        fromMe: result.fromMe
      },
      status: result.status
    }
  });
}
