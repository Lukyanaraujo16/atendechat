import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";

export default async function PauseTicketAiAgentService(input: {
  companyId: number;
  ticketId: number;
  userId: number;
}): Promise<Ticket> {
  const ticket = await ShowTicketService(input.ticketId, input.companyId);
  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await ticket.update({
    aiAgentPaused: true,
    aiAgentPausedAt: new Date(),
    aiAgentPausedBy: input.userId
  });

  return ticket;
}
