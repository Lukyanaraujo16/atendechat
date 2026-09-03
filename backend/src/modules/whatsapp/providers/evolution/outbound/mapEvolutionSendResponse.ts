import { WhatsAppOutboundSendResult } from "../../../outbound/WhatsAppOutbound";
import {
  mapEvolutionStatusToAck,
  STREAMHUB_ACK
} from "../inbound/mapEvolutionStatusToAck";

/**
 * Normaliza resposta Evolution send* → WhatsAppOutboundSendResult.
 * rawSentMessage = envelope provider-aware (NÃO proto Baileys).
 * Mantém key.id para callers legados que leem .key.id.
 *
 * Contrato .status = ACK numérico StreamHub 0–5 (igual Baileys WAMessage.status).
 * O status textual Evolution fica em providerStatus (dataJson), nunca em Messages.ack.
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

  const mappedAck = mapEvolutionStatusToAck(root.status);
  const ack = mappedAck != null ? mappedAck : STREAMHUB_ACK.PENDING;
  const providerStatus = root.status != null ? root.status : "PENDING";

  const rawSentMessage = {
    provider: "evolution",
    key: {
      id: messageId,
      remoteJid,
      fromMe
    },
    messageTimestamp:
      root.messageTimestamp != null ? root.messageTimestamp : null,
    status: ack,
    providerStatus,
    messageId,
    remoteJid,
    fromMe
  };

  return {
    messageId,
    remoteJid,
    fromMe,
    status: ack,
    rawSentMessage
  };
}

/** Persistência: payload.status textual; Messages.ack usa envelope.status numérico. */
export function buildEvolutionOutboundDataJsonFromEnvelope(
  envelope: unknown
): string {
  const raw =
    envelope && typeof envelope === "object"
      ? (envelope as Record<string, unknown>)
      : {};
  const key =
    raw.key && typeof raw.key === "object"
      ? (raw.key as Record<string, unknown>)
      : {};
  const textualStatus =
    raw.providerStatus != null ? raw.providerStatus : "PENDING";
  return JSON.stringify({
    provider: "evolution",
    payload: {
      key: {
        id: key.id ?? null,
        remoteJid: key.remoteJid ?? null,
        fromMe: key.fromMe ?? true
      },
      status: textualStatus
    }
  });
}

/** dataJson Evolution outbound sanitizado (sem apikey/base64). */
export function buildEvolutionOutboundDataJson(
  result: WhatsAppOutboundSendResult
): string {
  return buildEvolutionOutboundDataJsonFromEnvelope(result.rawSentMessage);
}
