import { v4 as uuidv4 } from "uuid";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import type { WhatsAppOutboundSendResult } from "../../modules/whatsapp/outbound/WhatsAppOutbound";
import { buildEvolutionOutboundDataJsonFromEnvelope } from "../../modules/whatsapp/providers/evolution/outbound/mapEvolutionSendResponse";
import CreateMessageService from "./CreateMessageService";

/**
 * Materializa Message after WhatsAppOutbound/SendWhatsApp* transport.
 * NÃO envia. Caller envia → este helper persiste + CreateMessageService emite appMessage.
 */

export type PersistWhatsAppOutboundInput = {
  ticket: Pick<Ticket, "id" | "companyId" | "whatsappId">;
  body: string;
  /** WhatsAppOutboundSendResult OU rawSentMessage (WAMessage / envelope Evolution). */
  sent: unknown;
  mediaType?: string;
  mediaUrl?: string | null;
  quotedMsgId?: string | null;
};

export type WhatsAppOutboundPersistIdentity = {
  messageId: string | null;
  remoteJid: string | null;
  ack: number | null;
  isEvolution: boolean;
  envelopeOrRaw: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isEvolutionEnvelope(raw: unknown): boolean {
  return isRecord(raw) && raw.provider === "evolution";
}

function isSendResult(sent: unknown): sent is WhatsAppOutboundSendResult {
  return (
    isRecord(sent) &&
    Object.prototype.hasOwnProperty.call(sent, "rawSentMessage")
  );
}

function trimId(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function extractKeyId(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const key = isRecord(raw.key) ? raw.key : null;
  const fromKey = trimId(key?.id);
  if (fromKey) return fromKey;
  return trimId(raw.messageId);
}

function extractKeyRemoteJid(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  const key = isRecord(raw.key) ? raw.key : null;
  const fromKey = trimId(key?.remoteJid);
  if (fromKey) return fromKey;
  return trimId(raw.remoteJid);
}

function extractAck(raw: unknown): number | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.status === "number" && Number.isFinite(raw.status)) {
    return raw.status;
  }
  return null;
}

export function resolveWhatsAppOutboundPersistIdentity(
  sent: unknown
): WhatsAppOutboundPersistIdentity {
  if (isSendResult(sent)) {
    const raw = sent.rawSentMessage;
    const isEvolution = isEvolutionEnvelope(raw);
    return {
      messageId: trimId(sent.messageId) || extractKeyId(raw),
      remoteJid: trimId(sent.remoteJid) || extractKeyRemoteJid(raw),
      ack:
        typeof sent.status === "number" && Number.isFinite(sent.status)
          ? sent.status
          : extractAck(raw),
      isEvolution,
      envelopeOrRaw: raw ?? sent
    };
  }

  return {
    messageId: extractKeyId(sent),
    remoteJid: extractKeyRemoteJid(sent),
    ack: extractAck(sent),
    isEvolution: isEvolutionEnvelope(sent),
    envelopeOrRaw: sent
  };
}

export async function persistWhatsAppOutboundMessage(
  input: PersistWhatsAppOutboundInput
): Promise<Message | null> {
  const { ticket, body, sent } = input;
  if (!ticket?.id || sent == null) {
    return null;
  }

  const identity = resolveWhatsAppOutboundPersistIdentity(sent);
  const idToSave = identity.messageId || uuidv4();
  let dataJson: string | undefined;
  if (identity.isEvolution) {
    dataJson = buildEvolutionOutboundDataJsonFromEnvelope(
      identity.envelopeOrRaw
    );
  } else if (identity.envelopeOrRaw != null) {
    dataJson = JSON.stringify(identity.envelopeOrRaw);
  }

  const saved = await CreateMessageService({
    messageData: {
      id: idToSave,
      ticketId: ticket.id,
      body,
      fromMe: true,
      read: true,
      ack: identity.ack != null ? identity.ack : undefined,
      mediaType: input.mediaType || "conversation",
      mediaUrl: input.mediaUrl ?? undefined,
      quotedMsgId: input.quotedMsgId || null,
      remoteJid: identity.remoteJid,
      externalMessageId: identity.isEvolution ? idToSave : undefined,
      ...(dataJson ? { dataJson } : {})
    } as never,
    companyId: ticket.companyId
  });

  if (identity.isEvolution && ticket.whatsappId != null && identity.messageId) {
    const { scheduleReapplyDeferredEvolutionAcks } = await import(
      "../../modules/whatsapp/providers/evolution/inbound/reapplyDeferredEvolutionAcks"
    );
    scheduleReapplyDeferredEvolutionAcks({
      companyId: ticket.companyId,
      whatsappId: Number(ticket.whatsappId),
      providerMessageId: identity.messageId
    });
  }

  return saved;
}
