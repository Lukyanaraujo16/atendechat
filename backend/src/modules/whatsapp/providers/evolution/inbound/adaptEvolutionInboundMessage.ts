import crypto from "crypto";
import { NormalizedWhatsAppMessage } from "../../../inbound/NormalizedWhatsAppMessage";
import { normalizeWhatsAppJidToNumber } from "../../../../../helpers/normalizeWhatsAppJidToNumber";
import {
  EvolutionAudioMessage,
  EvolutionDocumentMessage,
  EvolutionImageMessage,
  EvolutionLocationMessage,
  EvolutionMediaContextInfo,
  EvolutionStickerMessage,
  EvolutionVideoMessage,
  EvolutionWebhookEnvelope,
  EvolutionWebhookMessageContent,
  EvolutionWebhookMessageData,
  isEvolutionMessageUpsertEvent
} from "./evolutionWebhookTypes";
import {
  EvolutionMediaExtractHints,
  collectEvolutionMediaHints
} from "./EvolutionMediaExtractor";
import { EvolutionBinaryMediaKind } from "./evolutionMediaLimits";

export type AdaptEvolutionResult =
  | {
      ok: true;
      inbound: NormalizedWhatsAppMessage;
      mediaHints: EvolutionMediaExtractHints | null;
    }
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

const BINARY_MEDIA_TYPES = new Set([
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "documentWithCaptionMessage",
  "stickerMessage"
]);

const ENRICHED_NON_BINARY = new Set([
  "reactionMessage",
  "contactMessage",
  "contactsArrayMessage",
  "locationMessage",
  "liveLocationMessage"
]);

const STILL_UNSUPPORTED = new Set([
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
  const keys = Object.keys(message);
  const matched = keys.find(
    key =>
      key !== "messageContextInfo" &&
      (TEXT_TYPES.has(key) ||
        BINARY_MEDIA_TYPES.has(key) ||
        ENRICHED_NON_BINARY.has(key) ||
        STILL_UNSUPPORTED.has(key))
  );
  return matched || null;
}

function contextStanza(
  ctx: EvolutionMediaContextInfo | undefined
): string | null {
  if (typeof ctx?.stanzaId === "string" && ctx.stanzaId.trim()) {
    return ctx.stanzaId.trim();
  }
  return null;
}

function extractQuotedStanzaIdFromMessageNode(
  messageType: string | null,
  message: EvolutionWebhookMessageContent | null | undefined
): string | null {
  if (!message) return null;
  if (messageType === "extendedTextMessage" || message.extendedTextMessage) {
    const stanza = contextStanza(message.extendedTextMessage?.contextInfo);
    if (stanza) return stanza;
  }
  if (messageType === "imageMessage") {
    const stanza = contextStanza(message.imageMessage?.contextInfo);
    if (stanza) return stanza;
  }
  if (messageType === "videoMessage") {
    const stanza = contextStanza(message.videoMessage?.contextInfo);
    if (stanza) return stanza;
  }
  if (messageType === "audioMessage") {
    const stanza = contextStanza(message.audioMessage?.contextInfo);
    if (stanza) return stanza;
  }
  if (messageType === "documentMessage") {
    const stanza = contextStanza(message.documentMessage?.contextInfo);
    if (stanza) return stanza;
  }
  if (messageType === "documentWithCaptionMessage") {
    const stanza = contextStanza(
      message.documentWithCaptionMessage?.message?.documentMessage?.contextInfo
    );
    if (stanza) return stanza;
  }
  if (messageType === "stickerMessage") {
    const stanza = contextStanza(message.stickerMessage?.contextInfo);
    if (stanza) return stanza;
  }
  if (messageType === "reactionMessage") {
    const id = message.reactionMessage?.key?.id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

function extractQuotedStanzaId(
  messageType: string | null,
  message: EvolutionWebhookMessageContent | null | undefined,
  data?: EvolutionWebhookMessageData | null
): string | null {
  const fromNode = extractQuotedStanzaIdFromMessageNode(messageType, message);
  if (fromNode) return fromNode;

  const fromMessageRoot = contextStanza(message?.contextInfo);
  if (fromMessageRoot) return fromMessageRoot;

  return contextStanza(data?.contextInfo);
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

function messageTypeToKind(
  messageType: string
): EvolutionBinaryMediaKind | null {
  switch (messageType) {
    case "imageMessage":
      return "image";
    case "videoMessage":
      return "video";
    case "audioMessage":
      return "audio";
    case "documentMessage":
    case "documentWithCaptionMessage":
      return "document";
    case "stickerMessage":
      return "sticker";
    default:
      return null;
  }
}

function resolveDocumentNode(
  message: EvolutionWebhookMessageContent
): EvolutionDocumentMessage | null {
  if (message.documentMessage) return message.documentMessage;
  return message.documentWithCaptionMessage?.message?.documentMessage || null;
}

function buildLocationBody(loc: EvolutionLocationMessage | undefined): string {
  if (!loc) return "Localização";
  const lat = loc.degreesLatitude;
  const lng = loc.degreesLongitude;
  if (typeof lat === "number" && typeof lng === "number") {
    const name = loc.name ? `${loc.name} — ` : "";
    const addr = loc.address ? `${loc.address} | ` : "";
    return `${name}${addr}https://maps.google.com/maps?q=${lat}%2C${lng}&z=17&hl=pt-BR|${lat}, ${lng}`;
  }
  if (loc.name || loc.address) {
    return [loc.name, loc.address].filter(Boolean).join(" — ");
  }
  return "Localização";
}

function buildBodyAndMedia(input: {
  messageType: string | null;
  message: EvolutionWebhookMessageContent | null;
  messageId: string;
}): {
  body: string | null;
  media: NormalizedWhatsAppMessage["media"];
  mediaHints: EvolutionMediaExtractHints | null;
  fail?: AdaptEvolutionResult;
} {
  const { messageType, message, messageId } = input;
  const emptyMedia = {
    hasMedia: false,
    mimetype: null as string | null,
    filename: null as string | null,
    caption: null as string | null,
    isPtt: false
  };

  if (!messageType) {
    return {
      body: null,
      media: emptyMedia,
      mediaHints: null,
      fail: { ok: false, reason: "unsupported_message_type", detail: "unknown" }
    };
  }

  if (STILL_UNSUPPORTED.has(messageType)) {
    return {
      body: null,
      media: emptyMedia,
      mediaHints: null,
      fail: {
        ok: false,
        reason: "unsupported_message_type",
        detail: messageType
      }
    };
  }

  // Texto
  if (TEXT_TYPES.has(messageType) || messageType === "conversation") {
    let body: string | null = null;
    if (typeof message?.conversation === "string") {
      body = message.conversation.trim() || null;
    } else if (message?.extendedTextMessage?.text) {
      body = String(message.extendedTextMessage.text).trim() || null;
    }
    if (!body) {
      return {
        body: null,
        media: emptyMedia,
        mediaHints: null,
        fail: { ok: false, reason: "empty_text", detail: messageType }
      };
    }
    return { body, media: emptyMedia, mediaHints: null };
  }

  // Binários
  const kind = messageTypeToKind(messageType);
  if (kind) {
    let mimetype: string | null = null;
    let caption: string | null = null;
    let filename: string | null = null;
    let isPtt = false;
    let node: Record<string, unknown> | null = null;
    let body: string;

    if (messageType === "imageMessage") {
      const img = message?.imageMessage as EvolutionImageMessage | undefined;
      mimetype = img?.mimetype || "image/jpeg";
      caption = img?.caption?.trim() || null;
      body = caption || "Imagem";
      node = asRecord(img);
    } else if (messageType === "videoMessage") {
      const vid = message?.videoMessage as EvolutionVideoMessage | undefined;
      mimetype = vid?.mimetype || "video/mp4";
      caption = vid?.caption?.trim() || null;
      filename = vid?.fileName || null;
      body = caption || "Vídeo";
      node = asRecord(vid);
    } else if (messageType === "audioMessage") {
      const aud = message?.audioMessage as EvolutionAudioMessage | undefined;
      mimetype = aud?.mimetype || "audio/ogg; codecs=opus";
      isPtt = Boolean(aud?.ptt);
      body = "Áudio";
      node = asRecord(aud);
    } else if (
      messageType === "documentMessage" ||
      messageType === "documentWithCaptionMessage"
    ) {
      const doc = message ? resolveDocumentNode(message) : null;
      mimetype = doc?.mimetype || "application/octet-stream";
      caption = doc?.caption?.trim() || null;
      filename = doc?.fileName || doc?.title || null;
      body = caption || filename || "Documento";
      node = asRecord(doc);
    } else {
      const stk = message?.stickerMessage as
        | EvolutionStickerMessage
        | undefined;
      mimetype = stk?.mimetype || "image/webp";
      body = "sticker";
      node = asRecord(stk);
    }

    const mediaHints = collectEvolutionMediaHints({
      kind,
      messageId,
      messageNode: node,
      mimetype,
      filename
    });

    return {
      body,
      media: {
        hasMedia: true,
        mimetype,
        filename,
        caption,
        isPtt
      },
      mediaHints
    };
  }

  // Enriquecidos sem binário
  if (
    messageType === "locationMessage" ||
    messageType === "liveLocationMessage"
  ) {
    const loc =
      messageType === "liveLocationMessage"
        ? message?.liveLocationMessage
        : message?.locationMessage;
    return {
      body: buildLocationBody(loc as EvolutionLocationMessage | undefined),
      media: emptyMedia,
      mediaHints: null
    };
  }

  if (messageType === "contactMessage") {
    const vcard = message?.contactMessage?.vcard;
    const display = message?.contactMessage?.displayName;
    const body =
      (typeof vcard === "string" && vcard.trim()) ||
      (typeof display === "string" && display.trim()) ||
      "Contato";
    return { body, media: emptyMedia, mediaHints: null };
  }

  if (messageType === "contactsArrayMessage") {
    return { body: "varios contatos", media: emptyMedia, mediaHints: null };
  }

  if (messageType === "reactionMessage") {
    const text = message?.reactionMessage?.text;
    const body =
      typeof text === "string" && text.trim() ? text.trim() : "reaction";
    return { body, media: emptyMedia, mediaHints: null };
  }

  return {
    body: null,
    media: emptyMedia,
    mediaHints: null,
    fail: {
      ok: false,
      reason: "unsupported_message_type",
      detail: messageType
    }
  };
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

  const built = buildBodyAndMedia({ messageType, message, messageId });
  if (built.fail) return built.fail;
  if (!built.body) {
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
    body: built.body,
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
    quotedStanzaId: extractQuotedStanzaId(messageType, message, data),
    mentionedJids: [],
    media: built.media,
    wrapping: { isEphemeral: false, isViewOnce: false },
    messageStubType: null,
    ack: null,
    editedMessageId: null,
    rawProviderMessage: null
  };

  return { ok: true, inbound, mediaHints: built.mediaHints };
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
