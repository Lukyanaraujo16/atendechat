/**
 * Resolve caminho interno a partir do `data` de um push OneSignal.
 * Não inclui conteúdo sensível; só IDs/uuid e targetUrl já seguros.
 */

function cleanSegment(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s !== "" ? s : null;
}

/**
 * @param {Record<string, unknown>|null|undefined} data
 * @returns {string|null} path absoluto da app (ex.: `/chats/uuid`)
 */
export function resolveOneSignalNotificationPath(data) {
  if (data == null || typeof data !== "object") {
    return null;
  }

  const targetUrl = cleanSegment(data.targetUrl);
  if (targetUrl && targetUrl.startsWith("/") && !targetUrl.startsWith("//")) {
    // Bloquear protocolos / hosts embutidos
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetUrl)) {
      return null;
    }
    return targetUrl;
  }

  const type = String(data.type || "").trim();

  if (
    type === "internal_chat_message" ||
    data.chatUuid != null ||
    data.chatId != null
  ) {
    const chatPath = cleanSegment(data.chatUuid) || cleanSegment(data.chatId);
    if (chatPath) {
      return `/chats/${encodeURIComponent(chatPath)}`;
    }
  }

  const ticketUuid = cleanSegment(data.ticketUuid);
  const ticketId = cleanSegment(data.ticketId);
  const pathId = ticketUuid || ticketId;
  if (pathId) {
    return `/tickets/${encodeURIComponent(pathId)}`;
  }

  return null;
}
