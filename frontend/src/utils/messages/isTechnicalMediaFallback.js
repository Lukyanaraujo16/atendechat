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

/** Tipos em que o filename não deve virar legenda no balão. Documentos continuam com nome. */
const TYPES_HIDE_FILENAME_CAPTION = new Set([
  "image",
  "sticker",
  "video",
  "audio"
]);

const IMAGE_FILENAME_ONLY = /^[^/\s]+\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i;
const VIDEO_FILENAME_ONLY = /^[^/\s]+\.(mp4|mov|webm|mkv|avi|3gp|mpeg|m4v)$/i;
const AUDIO_FILENAME_ONLY = /^[^/\s]+\.(mp3|ogg|opus|m4a|wav|webm|aac|amr)$/i;

const LOCATION_MEDIA_TYPES = new Set([
  "locationMessage",
  "liveLocationMessage",
]);

const SHARED_CONTACT_MEDIA_TYPES = new Set([
  "vcard",
  "contactMessage",
  "contactsArrayMessage",
]);

export function mediaUrlBasename(mediaUrl) {
  if (!mediaUrl) return "";
  try {
    const withoutQuery = String(mediaUrl).split("?")[0].split("#")[0];
    const parts = withoutQuery.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "");
  } catch (_err) {
    return "";
  }
}

/**
 * Filename técnico (originalname / basename da URL / sentinela "-") usado como body.
 * Não se aplica a documentos: o nome do arquivo continua visível.
 */
export function isTechnicalFilenameCaption(body, message) {
  if (!message || !TYPES_HIDE_FILENAME_CAPTION.has(message.mediaType)) {
    return false;
  }
  const trimmed = String(body ?? "").trim();
  if (!trimmed || trimmed === "-") {
    return true;
  }

  const urlName = mediaUrlBasename(message.mediaUrl);
  if (urlName && trimmed.toLowerCase() === urlName.toLowerCase()) {
    return true;
  }

  if (/\s/.test(trimmed)) {
    return false;
  }

  if (message.mediaType === "image" || message.mediaType === "sticker") {
    return IMAGE_FILENAME_ONLY.test(trimmed);
  }
  if (message.mediaType === "video") {
    return VIDEO_FILENAME_ONLY.test(trimmed);
  }
  if (message.mediaType === "audio") {
    return AUDIO_FILENAME_ONLY.test(trimmed);
  }
  return false;
}

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

  if (isTechnicalFilenameCaption(body, message)) {
    return null;
  }

  if (LOCATION_MEDIA_TYPES.has(mediaType) || SHARED_CONTACT_MEDIA_TYPES.has(mediaType)) {
    return null;
  }

  const INSTAGRAM_CARD_MEDIA_TYPES = new Set([
    "instagram_post",
    "instagram_reel",
    "instagram_story",
    "instagram_profile",
    "instagram_unsupported",
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
