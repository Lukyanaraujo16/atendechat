import Message from "../models/Message";

export function isStickerMessage(message: Message): boolean {
  if (!message) return false;

  if (message.mediaType === "sticker") {
    return Boolean(message.getDataValue("mediaUrl"));
  }

  if (
    message.mediaType === "image" &&
    String(message.body || "").toLowerCase() === "sticker"
  ) {
    return Boolean(message.getDataValue("mediaUrl"));
  }

  const rawJson = message.dataJson;
  if (!rawJson) return false;

  try {
    const parsed = JSON.parse(rawJson);
    return Boolean(
      parsed?.message?.stickerMessage ||
        parsed?.stickerMessage
    );
  } catch {
    return false;
  }
}
