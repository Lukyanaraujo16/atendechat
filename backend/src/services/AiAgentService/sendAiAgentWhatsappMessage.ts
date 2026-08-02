import { v4 as uuidv4 } from "uuid";
import formatBody from "../../helpers/Mustache";
import Ticket from "../../models/Ticket";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import { AI_AGENT_MESSAGE_ORIGIN } from "./aiAgentLiveConfig";
import { formatAiAgentSignedMessage } from "./formatAiAgentSignedMessage";
import { sanitizeAiAgentClientFacingText } from "./buildAiAgentHandoffTransitionMessage";

export type SendAiAgentWhatsappMessageInput = {
  ticket: Ticket;
  body: string;
  companyId: number;
  aiAgentId: number;
  aiAgentRuntimeLogId: number | null;
  agentName?: string | null;
  alreadySigned?: boolean;
};

export type SendAiAgentWhatsappMessageResult =
  | { ok: true; messageId: string; bodySent: string }
  | { ok: false; error: string };

export default async function sendAiAgentWhatsappMessage(
  input: SendAiAgentWhatsappMessageInput
): Promise<SendAiAgentWhatsappMessageResult> {
  try {
    const sanitized = sanitizeAiAgentClientFacingText(input.body);
    const signed = input.alreadySigned
      ? {
          body: sanitized,
          agentName: String(input.agentName || "").trim() || "Assistente",
          signed: true,
          deduped: false
        }
      : formatAiAgentSignedMessage({
          agentName: input.agentName,
          content: sanitized
        });

    if (!signed.body) {
      return { ok: false, error: "empty_body" };
    }

    const sentMessage = await SendWhatsAppMessage({
      body: signed.body,
      ticket: input.ticket
    });
    const bodyToSave = formatBody(signed.body, input.ticket.contact);
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
        aiAgentRuntimeLogId: input.aiAgentRuntimeLogId ?? null,
        dataJson: JSON.stringify(sentMessage)
      } as never,
      companyId: input.companyId
    });

    await input.ticket.update({
      lastMessage: bodyToSave,
      fromMe: true
    });

    logger.info(
      {
        event: "ai_agent.message_signed",
        companyId: input.companyId,
        ticketId: input.ticket.id,
        agentId: input.aiAgentId,
        channel: "whatsapp",
        result: signed.deduped ? "deduped" : "signed"
      },
      "ai_agent.message_signed"
    );

    return { ok: true, messageId, bodySent: bodyToSave };
  } catch (err) {
    return {
      ok: false,
      error: String((err as Error)?.message || err || "send_failed")
    };
  }
}
