import PinnedTicket from "../../models/PinnedTicket";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import {
  assertUserCanAccessTicketResource,
  toTicketAccessPayload,
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
    where: { id: ticketId, companyId },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "isGroup", "groupVisible", "companyId"],
        required: false
      }
    ]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await assertUserCanAccessTicketResource(
    user,
    toTicketAccessPayload(ticket),
    companyId
  );

  await PinnedTicket.destroy({
    where: { userId, companyId, ticketId }
  });
};

export default UnpinTicketService;
