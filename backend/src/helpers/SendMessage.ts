import Whatsapp from "../models/Whatsapp";
import { getWhatsAppOutboundForWhatsapp } from "../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import fs from "fs";

import { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";

export type MessageData = {
  number: number | string;
  body: string;
  mediaPath?: string;
  fileName?: string;
};

export const SendMessage = async (
  whatsapp: Whatsapp,
  messageData: MessageData
): Promise<any> => {
  try {
    const outbound = await getWhatsAppOutboundForWhatsapp(whatsapp);
    const chatId = `${messageData.number}@s.whatsapp.net`;

    let message;

    if (messageData.mediaPath) {
      const options = await getMessageOptions(
        messageData.fileName,
        messageData.mediaPath,
        messageData.body
      );
      if (options) {
        const body = fs.readFileSync(messageData.mediaPath);
        message = (
          await outbound.sendContent({
            jid: chatId,
            content: { ...options }
          })
        ).rawSentMessage;
      }
    } else {
      const body = `\u200e ${messageData.body}`;
      message = (await outbound.sendText({ jid: chatId, text: body }))
        .rawSentMessage;
    }

    return message;
  } catch (err: any) {
    throw new Error(err);
  }
};
