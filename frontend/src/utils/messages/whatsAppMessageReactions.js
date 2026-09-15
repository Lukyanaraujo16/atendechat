/**
 * Reações WhatsApp associadas à mensagem alvo (não Instagram).
 */

const WHATSAPP_REACTIONS_META_KEY = "whatsappReactions";

export function isWhatsAppReactionTimelineItem(message) {
  if (!message || message.isDeleted) return false;
  const channel = String(message.channel || "whatsapp").toLowerCase();
  if (channel === "instagram") return false;
  return message.mediaType === "reactionMessage";
}

function parseMetaPayload(message) {
  if (!message?.metaPayload) return null;
  if (typeof message.metaPayload === "object") return message.metaPayload;
  try {
    return JSON.parse(message.metaPayload);
  } catch (_err) {
    return null;
  }
}

function reactionsFromMeta(message) {
  const meta = parseMetaPayload(message);
  const raw = meta?.[WHATSAPP_REACTIONS_META_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const emoji = String(item?.emoji || "").trim();
      if (!emoji || emoji.toLowerCase() === "reaction") return null;
      return {
        emoji,
        fromMe: Boolean(item.fromMe),
        reactorKey: String(item.reactorKey || ""),
      };
    })
    .filter(Boolean);
}

function reactionsFromLegacyBubbles(message, allMessages) {
  if (!Array.isArray(allMessages) || !message?.id) return [];
  return allMessages
    .filter(
      (item) =>
        isWhatsAppReactionTimelineItem(item) &&
        (item.quotedMsgId === message.id || item.quotedMsg?.id === message.id)
    )
    .map((item) => {
      const emoji = String(item.body || "").trim();
      if (!emoji || emoji.toLowerCase() === "reaction") return null;
      return {
        emoji,
        fromMe: Boolean(item.fromMe),
        reactorKey: item.fromMe ? "me" : String(item.id),
      };
    })
    .filter(Boolean);
}

export function getWhatsAppMessageReactions(message, allMessages = []) {
  if (!message) return [];
  const channel = String(message.channel || "whatsapp").toLowerCase();
  if (channel === "instagram") return [];

  const merged = new Map();
  [...reactionsFromMeta(message), ...reactionsFromLegacyBubbles(message, allMessages)].forEach(
    (item) => {
      const key = item.reactorKey || `${item.fromMe ? "me" : "peer"}:${item.emoji}`;
      merged.set(key, item);
    }
  );
  return Array.from(merged.values());
}

export function getWhatsAppReactionEmojis(message, allMessages = []) {
  const seen = new Set();
  const emojis = [];
  getWhatsAppMessageReactions(message, allMessages).forEach((item) => {
    if (!seen.has(item.emoji)) {
      seen.add(item.emoji);
      emojis.push(item.emoji);
    }
  });
  return emojis;
}
