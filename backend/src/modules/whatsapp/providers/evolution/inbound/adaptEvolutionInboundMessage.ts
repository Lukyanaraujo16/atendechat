import crypto from "crypto";
import { NormalizedWhatsAppMessage } from "../../../inbound/NormalizedWhatsAppMessage";
import { normalizeWhatsAppJidToNumber } from "../../../../../helpers/normalizeWhatsAppJidToNumber";
import {
  EvolutionWebhookEnvelope,
  EvolutionWebhookMessageContent,
  EvolutionWebhookMessageData,
  isEvolutionMessageUpsertEvent
} from "./evolutionWebhookTypes";

export type AdaptEvolutionResult =
  | { ok: true; inbound: NormalizedWhatsAppMessage }
  | {
      ok: false;
      reason:
        | "unsupported_event"
        | "invalid_payload"
        | "missing_message_id"
        | "missing_remote_jid"
        | "unsupported_message_type"
        | "unresolvable_contact"
        | "empty_text";
      detail?: string;
    };

const TEXT_TYPES = new Set([
  "conversation",
  "extendedTextMessage",
  "extendedText"
]);

const MEDIA_OR_OTHER_TYPES = new Set([
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "documentWithCaptionMessage",
  "stickerMessage",
  "reactionMessage",
  "contactMessage",
  "contactsArrayMessage",
  "locationMessage",
  "liveLocationMessage",
  "buttonsMessage",
  "listMessage",
  "templateMessage",
  "viewOnceMessage",
  "ephemeralMessage"
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickMessageData(
  envelope: EvolutionWebhookEnvelope
): EvolutionWebhookMessageData | null {
  const { data } = envelope;
  if (!data) return null;
  if (Array.isArray(data)) {
    return (data[0] as EvolutionWebhookMessageData) || null;
  }
  return data as EvolutionWebhookMessageData;
}

function detectMessageType(
  data: EvolutionWebhookMessageData,
  message: EvolutionWebhookMessageContent | null | undefined
): string | null {
  if (typeof data.messageType === "string" && data.messageType.trim()) {
    return data.messageType.trim();
  }
  if (!message) return null;
  if (typeof message.conversation === "string") return "conversation";
  if (message.extendedTextMessage) return "extendedTextMessage";
  const matched = Object.keys(message).find(
    key =>
      key !== "messageContextInfo" &&
      (TEXT_TYPES.has(key) || MEDIA_OR_OTHER_TYPES.has(key))
  );
  return matched || null;
}

function extractTextBody(
  messageType: string | null,
  message: EvolutionWebhookMessageContent | null | undefined
): string | null {
  if (!message) return null;
  if (
    messageType === "conversation" ||
    typeof message.conversation === "string"
  ) {
    const t = String(message.conversation || "").trim();
    return t.length > 0 ? t : null;
  }
  const ext = message.extendedTextMessage;
  if (ext && typeof ext.text === "string") {
    const t = ext.text.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function extractQuotedStanzaId(
  message: EvolutionWebhookMessageContent | null | undefined
): string | null {
  const stanza = message?.extendedTextMessage?.contextInfo?.stanzaId;
  if (typeof stanza === "string" && stanza.trim()) return stanza.trim();
  return null;
}

function parseTimestamp(
  data: EvolutionWebhookMessageData,
  envelope: EvolutionWebhookEnvelope
): Date | null {
  const ts = data.messageTimestamp;
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms);
  }
  if (typeof ts === "string" && ts.trim()) {
    const n = Number(ts);
    if (Number.isFinite(n)) {
      const ms = n > 1e12 ? n : n * 1000;
      return new Date(ms);
    }
  }
  if (typeof envelope.date_time === "string" && envelope.date_time.trim()) {
    const d = new Date(envelope.date_time);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Converte envelope Evolution real → NormalizedWhatsAppMessage.
 * Sem estruturas do provider Baileys; rawProviderMessage permanece null.
 */
export function adaptEvolutionInboundMessage(input: {
  envelope: EvolutionWebhookEnvelope;
  companyId: number;
  whatsappId: number;
}): AdaptEvolutionResult {
  const { envelope, companyId, whatsappId } = input;
  const event = envelope.event != null ? String(envelope.event).trim() : "";

  if (!isEvolutionMessageUpsertEvent(event)) {
    return { ok: false, reason: "unsupported_event", detail: event || "empty" };
  }

  const data = pickMessageData(envelope);
  if (!data || !asRecord(data)) {
    return { ok: false, reason: "invalid_payload", detail: "missing_data" };
  }

  const key = data.key || {};
  const messageId = key.id != null ? String(key.id).trim() : "";
  if (!messageId) {
    return { ok: false, reason: "missing_message_id" };
  }

  const remoteJid = key.remoteJid != null ? String(key.remoteJid).trim() : "";
  if (!remoteJid) {
    return { ok: false, reason: "missing_remote_jid" };
  }

  const message = (data.message ||
    null) as EvolutionWebhookMessageContent | null;
  const messageType = detectMessageType(data, message);

  if (messageType && MEDIA_OR_OTHER_TYPES.has(messageType)) {
    return {
      ok: false,
      reason: "unsupported_message_type",
      detail: messageType
    };
  }

  if (
    messageType &&
    !TEXT_TYPES.has(messageType) &&
    messageType !== "conversation"
  ) {
    // tipo desconhecido sem campos de texto
    const bodyProbe = extractTextBody(messageType, message);
    if (!bodyProbe) {
      return {
        ok: false,
        reason: "unsupported_message_type",
        detail: messageType
      };
    }
  }

  const body = extractTextBody(messageType, message);
  if (!body) {
    return {
      ok: false,
      reason: "empty_text",
      detail: messageType || undefined
    };
  }

  const isGroup = remoteJid.endsWith("@g.us");
  const participant =
    key.participant != null ? String(key.participant).trim() : "";
  const fromMe = Boolean(key.fromMe);

  const remoteJidAlt =
    key.remoteJidAlt != null ? String(key.remoteJidAlt) : undefined;
  const participantPn =
    key.participantPn != null ? String(key.participantPn) : undefined;
  const senderPnKey = key.senderPn != null ? String(key.senderPn) : undefined;
  // Em grupo, envelope.sender não é fonte confiável do participante (pode ser
  // outro JID do envelope). Preferir key.participant / participantPn / senderPn.
  const senderPn = isGroup
    ? senderPnKey || participantPn
    : senderPnKey ||
      (typeof envelope.sender === "string" ? envelope.sender : undefined);

  const jidForNumber = isGroup
    ? participant || remoteJidAlt || senderPn || ""
    : remoteJid;

  if (isGroup && !participant && !participantPn) {
    return {
      ok: false,
      reason: "unresolvable_contact",
      detail: "group_missing_participant"
    };
  }

  if (
    jidForNumber.includes("@lid") &&
    !senderPn &&
    !remoteJidAlt &&
    !participantPn
  ) {
    return {
      ok: false,
      reason: "unresolvable_contact",
      detail: "lid_without_pn"
    };
  }

  const senderNumber = normalizeWhatsAppJidToNumber(jidForNumber, {
    senderPn,
    remoteJidAlt,
    participantPn
  });

  if (!senderNumber && !isGroup) {
    return {
      ok: false,
      reason: "unresolvable_contact",
      detail: jidForNumber
    };
  }

  const inbound: NormalizedWhatsAppMessage = {
    provider: "evolution",
    companyId,
    whatsappId,
    messageId,
    fromMe,
    timestamp: parseTimestamp(data, envelope),
    messageType: messageType || "conversation",
    body,
    pushName:
      typeof data.pushName === "string" && data.pushName.trim()
        ? data.pushName.trim()
        : null,
    isGroup,
    addressing: {
      remoteJid,
      participant,
      senderPn,
      remoteJidAlt,
      participantPn
    },
    senderNumber: senderNumber || null,
    quotedStanzaId: extractQuotedStanzaId(message),
    mentionedJids: [],
    media: {
      hasMedia: false,
      mimetype: null,
      filename: null,
      caption: null,
      isPtt: false
    },
    wrapping: { isEphemeral: false, isViewOnce: false },
    messageStubType: null,
    ack: null,
    editedMessageId: null,
    rawProviderMessage: null
  };

  return { ok: true, inbound };
}

export function buildEvolutionExternalEventId(input: {
  whatsappId: number;
  messageId: string | null;
  eventType: string;
  payloadHashSeed?: string;
}): string {
  if (input.messageId) {
    return `evo:${input.whatsappId}:${input.messageId}`;
  }
  const hash = crypto
    .createHash("sha256")
    .update(
      `${input.whatsappId}|${input.eventType}|${input.payloadHashSeed || ""}`
    )
    .digest("hex")
    .slice(0, 40);
  return `evo:${input.whatsappId}:evt:${hash}`;
}
