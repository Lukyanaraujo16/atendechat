import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO, subDays } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import { intersection } from "lodash";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  updatedAt?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
  tags: number[];
  users: number[];
  companyId: number;
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

/** Fila em uma das filas permitidas OU sem fila (null) — evita Op.or com array bruto (SQL inválido). */
function queueInAllowedOrUnassigned(queueIds: number[]): Filterable["where"] {
  if (!queueIds?.length) {
    return { queueId: null };
  }
  return {
    [Op.or]: [{ queueId: { [Op.in]: queueIds } }, { queueId: null }]
  };
}

const ListTicketsServiceKanban = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  tags,
  users,
  status,
  date,
  updatedAt,
  showAll,
  userId,
  withUnreadMessages,
  companyId
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {
    [Op.and]: [
      { [Op.or]: [{ userId }, { status: "pending" }] },
      queueInAllowedOrUnassigned(queueIds)
    ]
  };
  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "email"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: User,
      as: "user",
      attributes: ["id", "name"]
    },
    {
      model: Tag,
      as: "tags",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["name"]
    },
  ];

  /** Fechados recentes no Kanban (evita lista infinita; ajustável) */
  const closedSince = subDays(new Date(), 365);
  const statusKanbanFilter =
    status && ["pending", "open", "closed"].includes(status)
      ? { status }
      : {
          [Op.or]: [
            { status: "pending" },
            { status: "open" },
            { status: "closed", updatedAt: { [Op.gte]: closedSince } }
          ]
        };

  if (showAll === "true") {
    whereCondition = statusKanbanFilter;
  } else {
    whereCondition = {
      [Op.and]: [
        {
          [Op.and]: [
            { [Op.or]: [{ userId }, { status: "pending" }] },
            queueInAllowedOrUnassigned(queueIds)
          ]
        },
        statusKanbanFilter
      ]
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          body: where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } },
        {
          "$message.body$": where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    };
  }

  if (date) {
    whereCondition = {
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (updatedAt) {
    whereCondition = {
      updatedAt: {
        [Op.between]: [
          +startOfDay(parseISO(updatedAt)),
          +endOfDay(parseISO(updatedAt))
        ]
      }
    };
  }

  if (withUnreadMessages === "true") {
    const user = await ShowUserService(userId);
    const userQueueIds = user.queues.map(queue => queue.id);

    whereCondition = {
      [Op.and]: [
        { [Op.or]: [{ userId }, { status: "pending" }] },
        queueInAllowedOrUnassigned(userQueueIds),
        { unreadMessages: { [Op.gt]: 0 } }
      ]
    };
  }

  if (Array.isArray(tags) && tags.length > 0) {
    const ticketsTagFilter: any[] | null = [];
    for (let tag of tags) {
      const ticketTags = await TicketTag.findAll({
        where: { tagId: tag }
      });
      if (ticketTags) {
        ticketsTagFilter.push(ticketTags.map(t => t.ticketId));
      }
    }

    const ticketsIntersection: number[] = intersection(...ticketsTagFilter);

    whereCondition = {
      ...whereCondition,
      id: {
        [Op.in]: ticketsIntersection
      }
    };
  }

  if (Array.isArray(users) && users.length > 0) {
    const ticketsUserFilter: any[] | null = [];
    for (let user of users) {
      const ticketUsers = await Ticket.findAll({
        where: { userId: user }
      });
      if (ticketUsers) {
        ticketsUserFilter.push(ticketUsers.map(t => t.id));
      }
    }

    const ticketsIntersection: number[] = intersection(...ticketsUserFilter);

    whereCondition = {
      ...whereCondition,
      id: {
        [Op.in]: ticketsIntersection
      }
    };
  }

  /**
   * Excluir só conversas de grupo da visão Kanban (1:1).
   * `isGroup = NULL` em tickets antigos não pode ser tratado como "grupo" — antes sumiam do Kanban.
   */
  whereCondition = {
    [Op.and]: [
      whereCondition,
      { companyId },
      {
        [Op.or]: [{ isGroup: false }, { isGroup: null }]
      }
    ]
  };

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    order: [["updatedAt", "DESC"]],
    subQuery: false
  });

  return {
    tickets,
    count,
    hasMore: false
  };
};

export default ListTicketsServiceKanban;