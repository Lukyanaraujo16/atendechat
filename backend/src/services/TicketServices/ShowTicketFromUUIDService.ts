import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import {
  setIsOrphanOnTicket,
  setStartedOutsideSystemOnTicket
} from "../../helpers/ticketOrphan";
import attachContactLabelsToContact from "../../helpers/attachContactLabelsToContact";
import { ensureGroupTicketPermanentOpen } from "../../helpers/groupTicketRules";
import {
  logGroupTicketAccessDebug,
  snapshotTicketIncludes
} from "../../helpers/groupTicketAccessDebug";

const ShowTicketUUIDService = async (uuid: string): Promise<Ticket> => {
  const ticket = await Ticket.findOne({
    where: {
      uuid
    },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: [
          "id",
          "name",
          "number",
          "email",
          "profilePicUrl",
          "isGroup",
          "groupVisible",
          "companyId"
        ],
        include: ["extraInfo"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["name", "status", "ticketVisibility"],
        required: false
      },
      {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color"]
      }
    ]
  }); 

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  logGroupTicketAccessDebug("ShowTicketFromUUIDService", "loaded", {
    uuid,
    ticketId: ticket.id,
    ...snapshotTicketIncludes(ticket),
    contactId: ticket.contact?.id,
    contactIsGroup: ticket.contact?.isGroup,
    whatsappId: ticket.whatsappId,
    whatsappTicketVisibility: ticket.whatsapp?.ticketVisibility,
    queueId: ticket.queue?.id,
    userId: ticket.user?.id
  });

  setIsOrphanOnTicket(ticket);
  setStartedOutsideSystemOnTicket(ticket);

  await attachContactLabelsToContact(ticket.contact, ticket.companyId);

  return ensureGroupTicketPermanentOpen(ticket);
};

export default ShowTicketUUIDService;
