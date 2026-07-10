import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";

export default async function ResumeTicketAiAgentService(input: {
  companyId: number;
  ticketId: number;
}): Promise<Ticket> {
  const ticket = await ShowTicketService(input.ticketId, input.companyId);
  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await ticket.update({
    aiAgentPaused: false,
    aiAgentPausedAt: null,
    aiAgentPausedBy: null,
    aiAgentHandoffRequested: false,
    aiAgentHandoffRequestedAt: null,
    aiAgentHandoffReason: null,
    aiAgentHandoffBy: null
  });

  return ticket;
}
