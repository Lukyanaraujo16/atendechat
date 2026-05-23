import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import ContactLabelRelation from "../../models/ContactLabelRelation";
import { intersection } from "lodash";
import Whatsapp from "../../models/Whatsapp";
import { parseTruthyQuery } from "../../utils/parseQueryBoolean";
import { attachTicketIsOrphanFlag } from "../../helpers/ticketOrphan";
import {
  attachTicketPinnedFlagsFromList,
  buildPinnedTicketOrderClause,
  isPinnedTicketsTableMissingError,
  loadPinnedTicketsForUser,
  logListTicketsQueryError
} from "../../helpers/ticketPinned";
import type { PinnedTicketListItem } from "../PinnedTicketServices/ListPinnedTicketsService";
import { logger } from "../../utils/logger";
import {
  buildNonAdminTicketListWhere,
  queueInAllowedOrUnassigned
} from "../../helpers/agentTicketListWhere";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  updatedAt?: string;
  showAll?: string | boolean;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
  tags: number[];
  contactLabels?: number[];
  users: number[];
  companyId: number;
  /** "true" = só tickets de grupo; omitido/"false" = exclui grupos das listas normais */
  isGroup?: string;
  userProfile?: string;
  supportMode?: boolean;
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  tags,
  contactLabels,
  users,
  status,
  date,
  updatedAt,
  showAll,
  userId,
  withUnreadMessages,
  companyId,
  isGroup,
  userProfile,
  supportMode
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"];

  if (parseTruthyQuery(showAll)) {
    whereCondition = queueInAllowedOrUnassigned(queueIds);
  } else {
    const userRow = await User.findByPk(userId, {
      attributes: ["allTicket"]
    });
    whereCondition = buildNonAdminTicketListWhere(
      userId,
      queueIds,
      userRow?.allTicket === "enabled"
    );
  }

  let includeCondition: Includeable[];

  const privileged =
    userProfile === "admin" || userProfile === "supervisor" || supportMode === true;

  includeCondition = [
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
        "groupVisible"
      ],
      ...(privileged
        ? {}
        : {
            where: {
              [Op.or]: [
                { isGroup: false },
                { isGroup: true, groupVisible: true }
              ]
            }
          })
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
      attributes: ["name", "status"],
      required: false
    },
  ];

  if (status) {
    whereCondition = {
      ...whereCondition,
      status
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
          "$messages.body$": where(
            fn("LOWER", col("messages.body")),
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
      ...buildNonAdminTicketListWhere(
        userId,
        userQueueIds,
        user?.allTicket === "enabled"
      ),
      unreadMessages: { [Op.gt]: 0 }
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

  if (Array.isArray(contactLabels) && contactLabels.length > 0) {
    const labelContactSets: number[][] = [];
    for (const labelId of contactLabels) {
      const rows = await ContactLabelRelation.findAll({
        where: { labelId, companyId },
        attributes: ["contactId"]
      });
      labelContactSets.push(rows.map((r) => r.contactId));
    }

    const unionContactIds = [...new Set(labelContactSets.flat())];

    if (!unionContactIds.length) {
      return { tickets: [], count: 0, hasMore: false };
    }

    whereCondition = {
      ...whereCondition,
      contactId: {
        [Op.in]: unionContactIds
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

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const pinForUser =
    status === "open" && userId != null && userId !== "";

  whereCondition = {
    ...whereCondition,
    companyId
  };

  if (isGroup === "true") {
    whereCondition = {
      ...whereCondition,
      isGroup: true,
      ...(!status ? { status: { [Op.in]: ["open", "pending"] } } : {})
    };
  } else {
    whereCondition = {
      ...whereCondition,
      isGroup: false
    };
  }

  const baseOrder: Array<[typeof Ticket, string, string]> = [
    [Ticket, "updatedAt", "DESC"]
  ];

  let pinnedList: PinnedTicketListItem[] = [];
  if (pinForUser) {
    pinnedList = await loadPinnedTicketsForUser(Number(userId), companyId);
  }

  const buildOrderClause = (withPinOrder: boolean) => {
    const pinOrder = withPinOrder
      ? buildPinnedTicketOrderClause(Number(userId), companyId)
      : [];
    return pinOrder.length ? [...pinOrder, ...baseOrder] : baseOrder;
  };

  const runListQuery = async (withPinOrder: boolean) => {
    const orderClause = buildOrderClause(withPinOrder);

    return Ticket.findAndCountAll({
      where: whereCondition,
      include: includeCondition,
      distinct: true,
      limit,
      offset,
      order: orderClause as any,
      subQuery: false
    });
  };

  let count: number;
  let tickets: Ticket[];

  try {
    ({ count, rows: tickets } = await runListQuery(pinForUser));
  } catch (err) {
    logListTicketsQueryError(err, {
      status,
      userId,
      companyId,
      pinnedOrderActive: pinForUser,
      order: buildOrderClause(pinForUser)
    });

    if (pinForUser && isPinnedTicketsTableMissingError(err)) {
      logger.warn(
        { companyId, userId, status },
        "[ListTicketsService] PinnedTickets table missing — listing without pin order"
      );
      ({ count, rows: tickets } = await runListQuery(false));
    } else {
      throw err;
    }
  }

  const hasMore = count > offset + tickets.length;

  attachTicketIsOrphanFlag(tickets);

  if (pinForUser) {
    attachTicketPinnedFlagsFromList(tickets, pinnedList);
  }

  if (status === "pending") {
    logger.info(
      {
        companyId,
        pageNumber,
        count,
        ticketIds: tickets.map((t) => t.id)
      },
      "[ListTicketsService] pending result ids"
    );
  }

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;