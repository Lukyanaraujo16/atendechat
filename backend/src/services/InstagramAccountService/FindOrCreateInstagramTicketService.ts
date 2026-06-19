import Ticket from "../../models/Ticket";
import InstagramAccountQueue from "../../models/InstagramAccountQueue";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { getIO } from "../../libs/socket";
import { toCompanyTicketAudience } from "../../helpers/companyTicketSocket";
import { logger } from "../../utils/logger";

interface Request {
  contactId: number;
  companyId: number;
  instagramAccountId: number;
  lastMessage: string;
  unreadMessages: number;
}

const resolveInstagramQueueId = async (
  companyId: number,
  instagramAccountId: number
): Promise<number | null> => {
  const rows = await InstagramAccountQueue.findAll({
    where: { companyId, instagramAccountId },
    attributes: ["queueId"]
  });

  if (rows.length === 1) {
    return rows[0].queueId;
  }

  return null;
};

const FindOrCreateInstagramTicketService = async ({
  contactId,
  companyId,
  instagramAccountId,
  lastMessage,
  unreadMessages
}: Request): Promise<{ ticket: Ticket; created: boolean }> => {
  const defaultQueueId = await resolveInstagramQueueId(
    companyId,
    instagramAccountId
  );

  let ticket = await Ticket.findOne({
    where: {
      contactId,
      companyId,
      channel: "instagram",
      instagramAccountId
    },
    order: [["id", "DESC"]]
  });

  let created = false;

  if (ticket) {
    const wasClosed = ticket.status === "closed";
    const nextUnread = (ticket.unreadMessages || 0) + unreadMessages;

    await ticket.update({
      unreadMessages: nextUnread,
      lastMessage,
      ...(wasClosed
        ? {
            status: "pending",
            userId: null,
            queueId: ticket.queueId ?? defaultQueueId
          }
        : {})
    });

    logger.info(
      {
        ticketId: ticket.id,
        companyId,
        contactId,
        instagramAccountId,
        wasClosed
      },
      "[InstagramInbound] ticket_found"
    );

    if (wasClosed) {
      const io = getIO();
      const ticketShow = await ShowTicketService(ticket.id, companyId);
      toCompanyTicketAudience(io, companyId, ticketShow).emit(
        `company-${companyId}-ticket`,
        {
          action: "update",
          ticket: ticketShow,
          ticketId: ticket.id
        }
      );
    }
  } else {
    ticket = await Ticket.create({
      contactId,
      companyId,
      channel: "instagram",
      instagramAccountId,
      whatsappId: null,
      status: "pending",
      unreadMessages,
      lastMessage,
      queueId: defaultQueueId,
      userId: null,
      isGroup: false
    });
    created = true;

    logger.info(
      {
        ticketId: ticket.id,
        companyId,
        contactId,
        instagramAccountId,
        queueId: defaultQueueId
      },
      "[InstagramInbound] ticket_created"
    );

    const io = getIO();
    const ticketShow = await ShowTicketService(ticket.id, companyId);
    toCompanyTicketAudience(io, companyId, ticketShow).emit(
      `company-${companyId}-ticket`,
      {
        action: "update",
        ticket: ticketShow,
        ticketId: ticket.id
      }
    );
  }

  return { ticket, created };
};

export default FindOrCreateInstagramTicketService;
