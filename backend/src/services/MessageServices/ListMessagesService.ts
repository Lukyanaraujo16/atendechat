import { FindOptions } from "sequelize/types";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import Queue from "../../models/Queue";
import { MessageWithParticipantDisplay } from "../../helpers/enrichGroupMessagesDisplay";
import { enrichGroupMessagesSafe } from "../../helpers/enrichGroupMessagesSafe";
import { isGroupTicket } from "../../helpers/groupTicketRules";

interface Request {
  ticketId: string;
  companyId: number;
  pageNumber?: string;
  queues?: number[];
  /** Quando o ticket está atribuído a este utilizador, não filtra mensagens por fila. */
  actorUserId?: string | number;
  /** Ticket já carregado (evita ShowTicketService + etiquetas duplicados na mesma request). */
  ticket?: Ticket;
}

interface Response {
  messages: Message[] | MessageWithParticipantDisplay[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId,
  companyId,
  queues = [],
  actorUserId,
  ticket: preloadedTicket
}: Request): Promise<Response> => {
  const ticket =
    preloadedTicket ?? (await ShowTicketService(ticketId, companyId));

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const options: FindOptions = {
    where: {
      ticketId,
      companyId
    }
  };

  const isDirectAssignee =
    actorUserId != null &&
    ticket.userId != null &&
    Number(ticket.userId) === Number(actorUserId);

  if (queues.length > 0 && !isDirectAssignee && !isGroupTicket(ticket)) {
    options.where["queueId"] = {
      [Op.or]: {
        [Op.in]: queues,
        [Op.eq]: null
      }
    };
  }

  const { count, rows: messages } = await Message.findAndCountAll({
    ...options,
    limit,
    include: [
      "contact",
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      },
      {
        model: Queue,
        as: "queue"
      }
    ],
    offset,
    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + messages.length;

  const ordered = messages.reverse();

  const enrichedMessages = isGroupTicket(ticket)
    ? await enrichGroupMessagesSafe(ordered, companyId, { ticketId })
    : ordered;

  return {
    messages: enrichedMessages,
    ticket,
    count,
    hasMore
  };
};

export default ListMessagesService;
