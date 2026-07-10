import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import { toCompanyTicketAudience } from "../../helpers/companyTicketSocket";
import ShowTicketService from "../TicketServices/ShowTicketService";

export type ApplyAiAgentHandoffInput = {
  ticket: Ticket;
  companyId: number;
  reason: string;
  by?: string;
  emitSocket?: boolean;
};

export default async function applyAiAgentHandoffToTicket(
  input: ApplyAiAgentHandoffInput
): Promise<Ticket> {
  const { ticket, companyId, reason } = input;
  const by = input.by ?? "ai_agent";

  if (ticket.aiAgentHandoffRequested === true) {
    return ticket;
  }

  const now = new Date();
  await ticket.update({
    aiAgentHandoffRequested: true,
    aiAgentHandoffRequestedAt: now,
    aiAgentHandoffReason: reason.slice(0, 120),
    aiAgentHandoffBy: by,
    aiAgentPaused: true,
    aiAgentPausedAt: now,
    aiAgentPausedBy: by === "ai_agent" ? null : ticket.aiAgentPausedBy
  });

  if (input.emitSocket !== false) {
    try {
      const ticketShow = await ShowTicketService(ticket.id, companyId);
      const io = getIO();
      toCompanyTicketAudience(io, companyId, {
        id: ticketShow.id,
        status: ticketShow.status,
        queueId: ticketShow.queueId,
        userId: ticketShow.userId
      }).emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket: ticketShow
      });
    } catch {
      // Socket é best-effort; handoff no ticket já foi persistido.
    }
  }

  return ticket;
}
