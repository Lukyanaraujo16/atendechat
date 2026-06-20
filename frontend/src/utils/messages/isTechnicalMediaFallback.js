/**
 * Detecta legendas técnicas geradas pelo backend (getBodyMessage) ou fallbacks
 * automáticos — não devem aparecer no balão quando há mídia.
 */

export const CONTEUDO_BRACKET_PATTERN =
  /^\[(?:Conteúdo|Content):\s*(.+)\]$/i;

/** Tipos WhatsApp crus salvos como body em mensagens antigas. */
const RAW_WA_TYPE_PATTERN = /^[a-zA-Z]+Message$/;

const MEDIA_PLACEHOLDER_BODIES = new Set([
  "áudio",
  "audio",
  "imagem",
  "image",
  "vídeo",
  "video",
  "documento",
  "document",
  "sticker",
  "reaction",
  "varios contatos",
  "vários contatos",
]);

const MEDIA_TYPES_WITH_URL = new Set([
  "image",
  "video",
  "audio",
  "sticker",
  "application",
  "document",
]);

/**
 * @param {string|null|undefined} text
 * @param {string|null|undefined} [mediaType]
 * @returns {boolean}
 */
export function isTechnicalMediaFallback(text, mediaType) {
  if (text == null) return false;
  const trimmed = String(text).trim();
  if (!trimmed) return false;

  if (CONTEUDO_BRACKET_PATTERN.test(trimmed)) {
    return true;
  }

  if (RAW_WA_TYPE_PATTERN.test(trimmed) && trimmed !== "contactMessage") {
    return true;
  }

  const lower = trimmed.toLowerCase();
  if (MEDIA_PLACEHOLDER_BODIES.has(lower)) {
    if (!mediaType) return true;
    if (mediaType === "conversation" || mediaType === "extendedTextMessage") {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * @param {{ body?: string|null, mediaType?: string|null, mediaUrl?: string|null }} message
 * @returns {string|null} body para exibir no balão, ou null se ocultar
 */
export function getDisplayableMessageBody(message) {
  if (!message) return null;

  const { body, mediaType, mediaUrl } = message;

  if (body == null || String(body).trim() === "") {
    return null;
  }

  if (mediaType === "locationMessage") {
    return null;
  }

  const INSTAGRAM_CARD_MEDIA_TYPES = new Set([
    "instagram_post",
    "instagram_reel",
    "instagram_story",
    "instagram_profile",
    "reaction",
  ]);

  if (INSTAGRAM_CARD_MEDIA_TYPES.has(mediaType)) {
    return null;
  }

  const hasMedia =
    Boolean(mediaUrl) ||
    (mediaType && MEDIA_TYPES_WITH_URL.has(mediaType));

  if (!isTechnicalMediaFallback(body, mediaType)) {
    return body;
  }

  const trimmed = String(body).trim();
  const alwaysHide =
    CONTEUDO_BRACKET_PATTERN.test(trimmed) ||
    (RAW_WA_TYPE_PATTERN.test(trimmed) && trimmed !== "contactMessage");

  if (alwaysHide || hasMedia) {
    return null;
  }

  return body;
}

/**
 * Extrai tipo WhatsApp de fallback técnico (ex.: imageMessage).
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
export function parseTechnicalFallbackWaType(text) {
  if (text == null) return null;
  const trimmed = String(text).trim();
  if (!trimmed) return null;

  const bracket = trimmed.match(CONTEUDO_BRACKET_PATTERN);
  if (bracket?.[1]) {
    return bracket[1].trim();
  }

  if (RAW_WA_TYPE_PATTERN.test(trimmed) && trimmed !== "contactMessage") {
    return trimmed;
  }

  return null;
}

export default isTechnicalMediaFallback;
