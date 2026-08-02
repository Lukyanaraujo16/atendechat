const BODY_PREVIEW_MAX = 140;

export type InternalChatMediaKind =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "text"
  | "unknown";

export function truncatePushPreview(s: string, max = BODY_PREVIEW_MAX): string {
  if (!s) return "";
  const t = String(s)
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function normalizeInternalChatMediaKind(
  mediaType?: string | null,
  mimeType?: string | null
): InternalChatMediaKind {
  const mt = String(mediaType || "").toLowerCase().trim();
  if (mt === "image" || mt === "audio" || mt === "video" || mt === "document") {
    return mt;
  }
  const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime) return "document";
  return "text";
}

export function buildInternalChatMediaLabel(
  kind: InternalChatMediaKind
): string | null {
  switch (kind) {
    case "image":
      return "Enviou uma imagem";
    case "audio":
      return "Enviou um áudio";
    case "video":
      return "Enviou um vídeo";
    case "document":
      return "Enviou um arquivo";
    default:
      return null;
  }
}

/**
 * Corpo comercial seguro do push de chat interno.
 * Não inclui URLs privadas, tokens ou texto completo longo.
 */
export function buildInternalChatPushBody(params: {
  senderName?: string | null;
  messageText?: string | null;
  mediaType?: string | null;
  mimeType?: string | null;
}): string {
  const sender =
    truncatePushPreview(String(params.senderName || "").trim(), 80) ||
    "Colega";
  const kind = normalizeInternalChatMediaKind(
    params.mediaType,
    params.mimeType
  );
  const mediaLabel = buildInternalChatMediaLabel(kind);
  const textPreview = truncatePushPreview(String(params.messageText || ""));

  let preview = textPreview;
  if (!preview && mediaLabel) {
    preview = mediaLabel;
  }
  if (!preview) {
    preview = "Nova mensagem";
  }

  return `${sender}: ${preview}`;
}

export function buildInternalChatTargetUrl(
  chatUuid: string | null | undefined,
  chatId: number
): string {
  const pathId =
    chatUuid != null && String(chatUuid).trim() !== ""
      ? String(chatUuid).trim()
      : String(chatId);
  return `/chats/${encodeURIComponent(pathId)}`;
}

export const INTERNAL_CHAT_PUSH_TITLE = "Nova mensagem no chat interno";
