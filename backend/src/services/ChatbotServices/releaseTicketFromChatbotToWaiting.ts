import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";

/**
 * Menu de fila (chatbot): ao concluir opção folha, libera para Aguardando.
 */
export const releaseTicketFromChatbotToWaiting = async (
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  if (!ticket?.id || !ticket.chatbot) {
    return;
  }
  const previousChatbot = ticket.chatbot;
  const previousQueueOptionId = ticket.queueOptionId;
  const { default: UpdateTicketService } = await import(
    "../TicketServices/UpdateTicketService"
  );
  await UpdateTicketService({
    ticketData: {
      status: "pending",
      chatbot: false,
      queueOptionId: null,
      userId: null,
      queueId: ticket.queueId ?? null,
      useIntegration: false,
      integrationId: null,
      promptId: null
    },
    ticketId: ticket.id,
    companyId
  });
  logger.info(
    {
      ticketId: ticket.id,
      companyId,
      queueId: ticket.queueId,
      chatbotBefore: previousChatbot,
      queueOptionIdBefore: previousQueueOptionId
    },
    "[Chatbot] ticket released to waiting (pending, chatbot=false)"
  );
};
