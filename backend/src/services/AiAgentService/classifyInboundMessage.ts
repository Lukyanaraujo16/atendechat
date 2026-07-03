import { proto, getContentType } from "@whiskeysockets/baileys";
import { AI_AGENT_EVALUATION_REASONS } from "./aiAgentEvaluationReasons";

export type InboundMessageProductType =
  | "text"
  | "audio"
  | "image"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "reaction"
  | "system"
  | "unknown";

export type InboundMessageClassification = {
  messageType: InboundMessageProductType;
  hasText: boolean;
  hasMedia: boolean;
  baileysType: string | null;
  blockReason?: (typeof AI_AGENT_EVALUATION_REASONS)[keyof typeof AI_AGENT_EVALUATION_REASONS];
};

function unwrapMessageContent(
  message: proto.IMessage | null | undefined,
  depth = 0
): proto.IMessage | null | undefined {
  if (!message || depth > 8) return message || undefined;
  const m = message as proto.IMessage & {
    ephemeralMessage?: { message?: proto.IMessage };
    viewOnceMessage?: { message?: proto.IMessage };
    viewOnceMessageV2?: { message?: proto.IMessage };
  };
  const next =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.documentWithCaptionMessage?.message;
  if (next) {
    return unwrapMessageContent(next, depth + 1) || next;
  }
  return message;
}

function isPlaceholderBody(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^\[[^\]]+\]$/.test(t)) return true;
  if (t === "Áudio" || t === "sticker" || t === "reaction") return true;
  if (t.startsWith("[Conteúdo:") || t.startsWith("[Mídia:")) return true;
  return false;
}

function isUsefulText(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (!t || isPlaceholderBody(t)) return false;
  if (t.includes("\u200c")) return false;
  return true;
}

function extractCaption(base: proto.IMessage | null | undefined): string | null {
  if (!base) return null;
  const cap =
    base.imageMessage?.caption ||
    base.videoMessage?.caption ||
    base.documentMessage?.caption ||
    base.documentWithCaptionMessage?.message?.documentMessage?.caption;
  if (cap == null) return null;
  const s = String(cap).trim();
  return s || null;
}

function hasMediaPayload(base: proto.IMessage | null | undefined): boolean {
  if (!base) return false;
  return !!(
    base.audioMessage ||
    base.imageMessage ||
    base.videoMessage ||
    base.documentMessage ||
    base.documentWithCaptionMessage ||
    base.stickerMessage
  );
}

function mapBaileysToProductType(
  baileysType: string,
  hasMedia: boolean
): InboundMessageProductType {
  switch (baileysType) {
    case "conversation":
    case "extendedTextMessage":
    case "buttonsResponseMessage":
    case "templateButtonReplyMessage":
    case "listResponseMessage":
    case "buttonsMessage":
    case "listMessage":
      return "text";
    case "audioMessage":
      return "audio";
    case "imageMessage":
      return "image";
    case "videoMessage":
      return "video";
    case "documentMessage":
    case "documentWithCaptionMessage":
      return "document";
    case "stickerMessage":
      return "sticker";
    case "locationMessage":
    case "liveLocationMessage":
      return "location";
    case "contactMessage":
    case "contactsArrayMessage":
      return "contact";
    case "reactionMessage":
      return "reaction";
    case "protocolMessage":
      return "system";
    default:
      return hasMedia ? "unknown" : "unknown";
  }
}

/**
 * Classifica mensagem inbound a partir do payload Baileys (não apenas body persistido).
 */
export function classifyInboundMessageFromBaileys(
  msg: proto.IWebMessageInfo,
  bodyFromListener?: string | null
): InboundMessageClassification {
  const base = unwrapMessageContent(msg.message);
  const baileysType = base ? getContentType(base) : null;
  const typeKey = baileysType || "unknown";
  const hasMedia = hasMediaPayload(base);
  const messageType = mapBaileysToProductType(typeKey, hasMedia);
  const caption = extractCaption(base);
  const listenerBody =
    bodyFromListener != null && String(bodyFromListener).trim() !== ""
      ? String(bodyFromListener)
      : null;

  const captionUseful = isUsefulText(caption);
  const listenerUseful =
    listenerBody != null && isUsefulText(listenerBody) && listenerBody !== caption;

  const hasText = captionUseful || listenerUseful;

  if (messageType === "reaction" || messageType === "system") {
    return {
      messageType,
      hasText: false,
      hasMedia,
      baileysType: typeKey,
      blockReason: AI_AGENT_EVALUATION_REASONS.UNSUPPORTED_MESSAGE_TYPE
    };
  }

  if (messageType === "sticker" || messageType === "location" || messageType === "contact") {
    return {
      messageType,
      hasText: false,
      hasMedia,
      baileysType: typeKey,
      blockReason: AI_AGENT_EVALUATION_REASONS.UNSUPPORTED_MESSAGE_TYPE
    };
  }

  if (messageType === "audio") {
    return {
      messageType,
      hasText: false,
      hasMedia: true,
      baileysType: typeKey,
      blockReason: AI_AGENT_EVALUATION_REASONS.AUDIO_NOT_SUPPORTED
    };
  }

  if (
    (messageType === "image" ||
      messageType === "video" ||
      messageType === "document") &&
    !captionUseful
  ) {
    return {
      messageType,
      hasText: false,
      hasMedia: true,
      baileysType: typeKey,
      blockReason: AI_AGENT_EVALUATION_REASONS.MEDIA_NOT_SUPPORTED
    };
  }

  if (messageType === "text" && !hasText) {
    return {
      messageType,
      hasText: false,
      hasMedia: false,
      baileysType: typeKey,
      blockReason: AI_AGENT_EVALUATION_REASONS.EMPTY_MESSAGE_BODY
    };
  }

  if (messageType === "unknown" && !hasText) {
    return {
      messageType,
      hasText: false,
      hasMedia,
      baileysType: typeKey,
      blockReason: AI_AGENT_EVALUATION_REASONS.UNSUPPORTED_MESSAGE_TYPE
    };
  }

  return {
    messageType,
    hasText,
    hasMedia,
    baileysType: typeKey
  };
}

export function isCampaignOrSystemText(body?: string | null): boolean {
  if (!body || typeof body !== "string") return false;
  return body.includes("\u200c");
}
