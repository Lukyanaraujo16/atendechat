import Ticket from "../../models/Ticket";
import PinnedTicket from "../../models/PinnedTicket";
import AppError from "../../errors/AppError";
import {
  assertTicketAccess,
  TicketAccessUser
} from "../../helpers/ticketAccess";

const MAX_PINNED_TICKETS = 3;

interface Request {
  ticketId: number;
  userId: number;
  companyId: number;
  user: TicketAccessUser;
}

const PinTicketService = async ({
  ticketId,
  userId,
  companyId,
  user
}: Request): Promise<PinnedTicket> => {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (ticket.status !== "open") {
    throw new AppError("ERR_PIN_ONLY_OPEN_TICKETS", 400);
  }

  await assertTicketAccess(user, ticket);

  const existing = await PinnedTicket.findOne({
    where: { userId, companyId, ticketId }
  });

  if (existing) {
    return existing;
  }

  const count = await PinnedTicket.count({
    where: { userId, companyId }
  });

  if (count >= MAX_PINNED_TICKETS) {
    throw new AppError(
      "ERR_MAX_PINNED_TICKETS",
      400,
      "Você pode fixar no máximo 3 conversas. Desafixe uma conversa para fixar outra."
    );
  }

  return PinnedTicket.create({
    userId,
    companyId,
    ticketId
  });
};

export default PinTicketService;
