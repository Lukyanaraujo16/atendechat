/**
 * Body enviado com mídia pelo composer do painel.
 * Imagem e vídeo sem texto do operador → string vazia (não media.name).
 * Documentos continuam usando filename como fallback.
 */

export function isOutgoingImageOrStickerMedia(media) {
  const type = String(media?.type || media?.mimetype || "").toLowerCase();
  return type.startsWith("image/");
}

export function isOutgoingVideoMedia(media) {
  const type = String(media?.type || media?.mimetype || "").toLowerCase();
  return type.startsWith("video/");
}

/**
 * @param {object} params
 * @param {string} [params.typedCaption]
 * @param {{ name?: string, type?: string, mimetype?: string }} params.media
 * @param {boolean} [params.isInstagramChannel]
 * @param {boolean} [params.isInstagramDocument]
 * @returns {string}
 */
export function resolveOutgoingMediaBody({
  typedCaption,
  media,
  isInstagramChannel = false,
  isInstagramDocument = false,
}) {
  const caption = String(typedCaption ?? "").trim();

  if (isInstagramDocument) {
    return media?.name || "";
  }

  if (caption) {
    return caption;
  }

  if (isInstagramChannel) {
    const type = String(media?.type || media?.mimetype || "").toLowerCase();
    if (type.startsWith("video/")) return "Vídeo";
    if (type.startsWith("audio/")) return "Áudio";
    return "Imagem";
  }

  if (isOutgoingImageOrStickerMedia(media) || isOutgoingVideoMedia(media)) {
    return "";
  }

  return media?.name || "";
}

/**
 * Monta o FormData de POST /messages/:ticketId para anexos do painel.
 * Não altera o File (media.name / filename físico).
 */
export function appendOutgoingMediaFormData(
  formData,
  { medias, typedCaption, isInstagramChannel, isInstagramDocumentFor }
) {
  formData.append("fromMe", true);
  (medias || []).forEach((media) => {
    formData.append("medias", media);
    const isInstagramDocument =
      typeof isInstagramDocumentFor === "function"
        ? Boolean(isInstagramDocumentFor(media))
        : false;
    formData.append(
      "body",
      resolveOutgoingMediaBody({
        typedCaption,
        media,
        isInstagramChannel,
        isInstagramDocument,
      })
    );
  });
  return formData;
}
