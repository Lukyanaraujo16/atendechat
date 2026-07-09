import { v4 as uuidv4 } from "uuid";
import formatBody from "../../helpers/Mustache";
import Ticket from "../../models/Ticket";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { AI_AGENT_MESSAGE_ORIGIN } from "./aiAgentLiveConfig";

export type SendAiAgentWhatsappMessageInput = {
  ticket: Ticket;
  body: string;
  companyId: number;
  aiAgentId: number;
  aiAgentRuntimeLogId: number;
};

export type SendAiAgentWhatsappMessageResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export default async function sendAiAgentWhatsappMessage(
  input: SendAiAgentWhatsappMessageInput
): Promise<SendAiAgentWhatsappMessageResult> {
  try {
    const sentMessage = await SendWhatsAppMessage({
      body: input.body,
      ticket: input.ticket
    });
    const bodyToSave = formatBody(input.body, input.ticket.contact);
    const messageId = sentMessage?.key?.id
      ? String(sentMessage.key.id)
      : uuidv4();

    await CreateMessageService({
      messageData: {
        id: messageId,
        ticketId: input.ticket.id,
        contactId: input.ticket.contactId,
        body: bodyToSave,
        fromMe: true,
        read: true,
        ack: sentMessage?.status,
        mediaType: "conversation",
        remoteJid: sentMessage?.key?.remoteJid,
        messageOrigin: AI_AGENT_MESSAGE_ORIGIN,
        aiAgentId: input.aiAgentId,
        aiAgentRuntimeLogId: input.aiAgentRuntimeLogId,
        dataJson: JSON.stringify(sentMessage)
      } as never,
      companyId: input.companyId
    });

    await input.ticket.update({
      lastMessage: bodyToSave,
      fromMe: true
    });

    return { ok: true, messageId };
  } catch (err) {
    return {
      ok: false,
      error: String((err as Error)?.message || err || "send_failed")
    };
  }
}
