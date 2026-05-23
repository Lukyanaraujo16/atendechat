import { i18n } from "../../translate/i18n";
import {
  isTechnicalMediaFallback,
  parseTechnicalFallbackWaType,
} from "./isTechnicalMediaFallback";

const AUDIO_LABELS = new Set(["áudio", "audio"]);
const IMAGE_LABELS = new Set(["imagem", "image", "foto", "photo"]);
const VIDEO_LABELS = new Set(["vídeo", "video"]);
const DOC_LABELS = new Set(["documento", "document", "arquivo", "file"]);

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|mov|webm|mkv|avi)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|ogg|wav|webm|m4a|aac|opus|amr)(\?|#|$)/i;
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|7z|odt|ods)(\?|#|$)/i;

const WA_TYPE_TO_PREVIEW_KEY = {
  imageMessage: "image",
  videoMessage: "video",
  audioMessage: "audio",
  documentMessage: "document",
  documentWithCaptionMessage: "document",
  stickerMessage: "sticker",
  contactMessage: "contact",
  contactsArrayMessage: "contact",
  locationMessage: "location",
  liveLocationMessage: "location",
  buttonsMessage: "interactive",
  listMessage: "interactive",
  templateMessage: "interactive",
  buttonsResponseMessage: "interactive",
  listResponseMessage: "interactive",
  templateButtonReplyMessage: "interactive",
  viewOnceMessage: "media",
  reactionMessage: "media",
};

function emptyPreview() {
  return { text: "", isMedia: false, useMarkdown: false };
}

function mediaPreview(i18nKey) {
  return {
    text: i18n.t(`ticketsListItem.preview.${i18nKey}`),
    isMedia: true,
    useMarkdown: false,
  };
}

function resolveRawInput(ticketOrRaw) {
  if (ticketOrRaw == null) return "";
  if (typeof ticketOrRaw === "object") {
    return String(
      ticketOrRaw.lastMessage ?? ticketOrRaw.body ?? ""
    ).trim();
  }
  return String(ticketOrRaw).trim();
}

function friendlyLabelFromTechnicalFallback(text) {
  const waType = parseTechnicalFallbackWaType(text);
  if (waType) {
    const previewKey = WA_TYPE_TO_PREVIEW_KEY[waType];
    if (previewKey) {
      return mediaPreview(previewKey);
    }
  }

  const lower = String(text).trim().toLowerCase();
  if (AUDIO_LABELS.has(lower)) return mediaPreview("audio");
  if (lower === "sticker") return mediaPreview("sticker");
  if (IMAGE_LABELS.has(lower)) return mediaPreview("image");
  if (VIDEO_LABELS.has(lower)) return mediaPreview("video");
  if (DOC_LABELS.has(lower)) return mediaPreview("document");
  if (lower === "varios contatos" || lower === "vários contatos") {
    return mediaPreview("contact");
  }

  return mediaPreview("media");
}

function heuristicMediaPreview(text) {
  const lower = text.toLowerCase();
  const firstToken =
    lower.split(/\s+/)[0]?.replace(/[^\wáàâãéêíóôõúç]/gi, "") || lower;

  if (AUDIO_LABELS.has(lower) || AUDIO_LABELS.has(firstToken) || AUDIO_EXT.test(text)) {
    return mediaPreview("audio");
  }

  if (
    IMAGE_LABELS.has(lower) ||
    lower === "sticker" ||
    IMAGE_EXT.test(text) ||
    /\/public\/[^\s]*\.(jpe?g|png|gif|webp)/i.test(text)
  ) {
    return lower === "sticker" ? mediaPreview("sticker") : mediaPreview("image");
  }

  if (VIDEO_LABELS.has(lower) || VIDEO_EXT.test(text)) {
    return mediaPreview("video");
  }

  if (
    DOC_LABELS.has(lower) ||
    DOC_EXT.test(text) ||
    /\/public\/[^\s]*\.(pdf|doc|xls|ppt|zip)/i.test(text)
  ) {
    return mediaPreview("document");
  }

  if (lower === "arquivo de mídia" || lower === "arquivo de midia") {
    return mediaPreview("media");
  }

  return null;
}

/**
 * Preview da última mensagem na lista lateral de tickets.
 * @param {string|{ lastMessage?: string|null, body?: string|null }} ticketOrRaw
 * @returns {{ text: string, isMedia: boolean, useMarkdown: boolean }}
 */
export function formatTicketLastMessagePreview(ticketOrRaw) {
  const text = resolveRawInput(ticketOrRaw);
  if (!text) {
    return emptyPreview();
  }

  if (
    text.includes("data:image/png;base64") ||
    text.includes("maps.google.com/maps")
  ) {
    return mediaPreview("location");
  }

  if (isTechnicalMediaFallback(text)) {
    return friendlyLabelFromTechnicalFallback(text);
  }

  const heuristic = heuristicMediaPreview(text);
  if (heuristic) {
    return heuristic;
  }

  return { text, isMedia: false, useMarkdown: true };
}

export default formatTicketLastMessagePreview;
