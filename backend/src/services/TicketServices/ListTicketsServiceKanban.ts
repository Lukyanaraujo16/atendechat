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
import { intersection } from "lodash";
import Whatsapp from "../../models/Whatsapp";
import { attachTicketIsOrphanFlag } from "../../helpers/ticketOrphan";
import { parseTruthyQuery } from "../../utils/parseQueryBoolean";
import { buildNonAdminTicketListWhere } from "../../helpers/agentTicketListWhere";
import {
  buildGroupContactVisibilityWhere,
  isGroupVisibilityPrivileged,
  loadUserQueueIds
} from "../../helpers/groupVisibility";
import {
  buildKanbanClosedStatusWhere,
  parseKanbanClosedPeriod
} from "../../helpers/kanbanClosedPeriod";

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
  users: number[];
  companyId: number;
  /** today | 7d | 30d | month | year | all — só afeta status closed */
  closedPeriod?: string;
  userProfile?: string;
  supportMode?: boolean;
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
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
  companyId,
  closedPeriod: closedPeriodParam,
  userProfile,
  supportMode
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"];
  let includeCondition: Includeable[];

  const actor = {
    id: userId,
    profile: userProfile,
    supportMode,
    companyId
  };
  const privileged = isGroupVisibilityPrivileged(actor);
  const userQueueIds = privileged ? [] : await loadUserQueueIds(userId);

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "email", "isGroup", "groupVisible"],
      ...(privileged
        ? {}
        : {
            where: buildGroupContactVisibilityWhere(actor, userQueueIds)
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

  const closedPeriod = parseKanbanClosedPeriod(closedPeriodParam);
  const closedStatusWhere = buildKanbanClosedStatusWhere(closedPeriod);

  const statusKanbanFilter =
    status && ["pending", "open", "closed"].includes(status)
      ? status === "closed"
        ? closedStatusWhere
        : { status }
      : {
          [Op.or]: [
            { status: "pending" },
            { status: "open" },
            closedStatusWhere
          ]
        };

  if (parseTruthyQuery(showAll)) {
    whereCondition = statusKanbanFilter;
  } else {
    const userRow = await User.findByPk(userId, {
      attributes: ["allTicket"]
    });
    whereCondition = {
      [Op.and]: [
        buildNonAdminTicketListWhere(
          userId,
          queueIds,
          userRow?.allTicket === "enabled"
        ),
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

  attachTicketIsOrphanFlag(tickets);

  return {
    tickets,
    count,
    hasMore: false
  };
};

export default ListTicketsServiceKanban;