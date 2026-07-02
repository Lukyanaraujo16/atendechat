import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import AiAgentOrchestrator from "./AiAgentOrchestrator";
import { persistAiAgentRuntimeLog } from "./AiAgentRuntimeLogService";

export type RunAiAgentDryRunHookInput = {
  companyId: number;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  messageId: string;
  fromMe: boolean;
  isGroup: boolean;
  body?: string | null;
};

/**
 * Avalia elegibilidade do Agente de IA (dry-run) após persistir mensagem inbound.
 * Não altera ticket, não envia resposta e não chama OpenAI.
 */
export async function runAiAgentDryRunHook(
  input: RunAiAgentDryRunHookInput
): Promise<void> {
  const evaluation = await AiAgentOrchestrator.evaluateInboundMessage({
    companyId: input.companyId,
    ticket: input.ticket,
    contact: input.contact,
    whatsapp: input.whatsapp,
    message: {
      id: input.messageId,
      fromMe: input.fromMe,
      body: input.body
    },
    channel: "whatsapp"
  });

  await persistAiAgentRuntimeLog({
    companyId: input.companyId,
    ticketId: input.ticket.id,
    contactId: input.contact.id,
    whatsappId: input.whatsapp.id,
    channel: "whatsapp",
    evaluation,
    messageId: input.messageId,
    metadata: {
      ticketStatus: input.ticket.status,
      ticketQueueId: input.ticket.queueId ?? null,
      ticketChatbot: input.ticket.chatbot === true,
      ticketUseIntegration: input.ticket.useIntegration === true,
      ticketFlowStopped: input.ticket.flowStopped ?? null,
      isGroup: input.isGroup
    }
  });
}
