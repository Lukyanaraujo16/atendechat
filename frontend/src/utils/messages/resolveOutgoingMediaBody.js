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

export function isOutgoingCaptionEligibleMedia(media) {
  return isOutgoingImageOrStickerMedia(media) || isOutgoingVideoMedia(media);
}

export function findFirstCaptionEligibleMediaIndex(medias) {
  const list = medias || [];
  for (let i = 0; i < list.length; i += 1) {
    if (isOutgoingCaptionEligibleMedia(list[i])) {
      return i;
    }
  }
  return -1;
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
  const list = medias || [];
  const captionEligibleIndex = findFirstCaptionEligibleMediaIndex(list);
  const hasVisualCaptionBatch = captionEligibleIndex >= 0;

  list.forEach((media, index) => {
    formData.append("medias", media);
    const isInstagramDocument =
      typeof isInstagramDocumentFor === "function"
        ? Boolean(isInstagramDocumentFor(media))
        : false;

    let captionForThis = typedCaption;
    if (isOutgoingCaptionEligibleMedia(media)) {
      captionForThis = index === captionEligibleIndex ? typedCaption : "";
    } else if (hasVisualCaptionBatch) {
      captionForThis = "";
    }

    formData.append(
      "body",
      resolveOutgoingMediaBody({
        typedCaption: captionForThis,
        media,
        isInstagramChannel,
        isInstagramDocument,
      })
    );
  });
  return formData;
}
