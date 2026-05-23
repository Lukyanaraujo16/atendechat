import PinnedTicket from "../../models/PinnedTicket";
import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import {
  assertTicketAccess,
  TicketAccessUser
} from "../../helpers/ticketAccess";

interface Request {
  ticketId: number;
  userId: number;
  companyId: number;
  user: TicketAccessUser;
}

const UnpinTicketService = async ({
  ticketId,
  userId,
  companyId,
  user
}: Request): Promise<void> => {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await assertTicketAccess(user, ticket);

  await PinnedTicket.destroy({
    where: { userId, companyId, ticketId }
  });
};

export default UnpinTicketService;
