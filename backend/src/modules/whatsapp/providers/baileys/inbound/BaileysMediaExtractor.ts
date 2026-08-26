import { downloadMediaMessage, proto } from "@whiskeysockets/baileys";
import { extension as mimeExtension } from "mime-types";
import { logger } from "../../../../../utils/logger";
import { unwrapMessageContent } from "./baileysInboundParsing";

export type BaileysExtractedMedia = {
  data: Buffer;
  mimetype: string;
  filename: string;
};

/**
 * Download/extraction de mídia Baileys.
 * Única camada que deve chamar downloadMediaMessage no inbound.
 */
export async function downloadBaileysMedia(
  msg: proto.IWebMessageInfo
): Promise<BaileysExtractedMedia | null> {
  let buffer: Buffer | undefined;
  try {
    // Baileys v7 alterou os tipos esperados por downloadMediaMessage
    // Mantemos o comportamento, apenas ajustando o cast de tipagem.
    buffer = await downloadMediaMessage(msg as never, "buffer", {});
  } catch (err) {
    console.error("Erro ao baixar mídia:", err);
    return null;
  }

  if (
    !buffer ||
    (Buffer.isBuffer(buffer)
      ? buffer.length === 0
      : !(buffer as { length?: number })?.length)
  ) {
    logger.warn(
      { messageId: msg.key?.id },
      "[WhatsAppInbound] download_media_empty"
    );
    return null;
  }

  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer as Uint8Array);
  }

  const effective = unwrapMessageContent(msg.message);
  let filename =
    effective?.documentMessage?.fileName ||
    effective?.documentWithCaptionMessage?.message?.documentMessage?.fileName ||
    msg.message?.documentMessage?.fileName ||
    "";

  const mineType =
    effective?.imageMessage ||
    effective?.audioMessage ||
    effective?.videoMessage ||
    effective?.stickerMessage ||
    effective?.documentMessage ||
    effective?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.imageMessage ||
    msg.message?.audioMessage ||
    msg.message?.videoMessage ||
    msg.message?.stickerMessage ||
    msg.message?.documentMessage ||
    msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

  if (!mineType) {
    logger.warn(
      { messageId: msg.key?.id },
      "[WhatsAppInbound] download_media_missing_mimetype"
    );
    return null;
  }

  if (!filename) {
    const ext = mimeExtension(mineType.mimetype) || "bin";
    filename = `${new Date().getTime()}.${ext}`;
  } else {
    filename = `${new Date().getTime()}_${filename}`;
  }

  return {
    data: buffer,
    mimetype: mineType.mimetype,
    filename
  };
}
