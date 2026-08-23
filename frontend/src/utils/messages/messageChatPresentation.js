/**
 * Regras de apresentação do balão de chat (mídia / menu / tombstone).
 * Não altera persistência: só decide o que renderizar.
 */

import { getDisplayableMessageBody } from "./isTechnicalMediaFallback";

export function isDeletedChatMessage(message) {
  return Boolean(message?.isDeleted);
}

export function shouldShowMessageActionMenu(message) {
  return Boolean(message) && !isDeletedChatMessage(message);
}

/**
 * Mídia visual (imagem, vídeo, áudio, arquivo, mapa).
 * Mensagem apagada nunca reabre preview/lightbox.
 */
export function shouldRenderChatMedia(message) {
  if (!message || isDeletedChatMessage(message)) {
    return false;
  }
  return (
    Boolean(message.mediaUrl) ||
    message.mediaType === "locationMessage" ||
    message.mediaType === "vcard"
  );
}

export function shouldUseImageLightbox(message) {
  if (!shouldRenderChatMedia(message)) {
    return false;
  }
  return message.mediaType === "image" || message.mediaType === "sticker";
}

export function shouldShowQuotedMessage(message) {
  return !isDeletedChatMessage(message) && Boolean(message?.quotedMsg);
}

/**
 * Plano único de render do balão — inbound e outbound usam as mesmas regras.
 */
export function getMessageBubblePresentation(message) {
  const deleted = isDeletedChatMessage(message);
  const showMedia = shouldRenderChatMedia(message);
  return {
    deleted,
    fromMe: Boolean(message?.fromMe),
    showActionMenu: shouldShowMessageActionMenu(message),
    showMedia,
    showTombstone: deleted,
    showQuoted: shouldShowQuotedMessage(message),
    displayBody: getDisplayableMessageBody(message),
    useImageLightbox: shouldUseImageLightbox(message),
  };
}
