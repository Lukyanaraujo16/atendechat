import { Sequelize, Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import TicketTag from "../../models/TicketTag";
import getTagsForContactIds from "./getTagsForContactIds";
import getLabelsForContactIds from "../../helpers/getLabelsForContactIds";
import getAssignmentsForContactIds from "../../helpers/getAssignmentsForContactIds";
import ContactLabelRelation from "../../models/ContactLabelRelation";
import {
  canViewAllCompanyContacts,
  applyContactVisibilityFilter,
  ContactAccessUser
} from "../../helpers/contactAccess";

const ALLOWED_PAGE_LIMITS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_LIMIT = 25;

function parsePageLimit(
  pageNumber?: string,
  limit?: string
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number(pageNumber) || 1);
  const rawLimit = Number(limit);
  const normalizedLimit = ALLOWED_PAGE_LIMITS.includes(
    rawLimit as (typeof ALLOWED_PAGE_LIMITS)[number]
  )
    ? rawLimit
    : DEFAULT_PAGE_LIMIT;
  return { page, limit: normalizedLimit, offset: (page - 1) * normalizedLimit };
}

function emptyListResult(page: number, limit: number) {
  return {
    contacts: [] as any[],
    count: 0,
    hasMore: false,
    page,
    limit,
    totalPages: 0
  };
}

interface Request {
  searchParam?: string;
  pageNumber?: string;
  limit?: string;
  companyId: number;
  tagId?: string;
  labelId?: string;
  dateFrom?: string;
  dateTo?: string;
  accessUser?: ContactAccessUser;
}

type LastTicketDto = {
  id: number;
  status: string;
  updatedAt: string;
};

const enrichContacts = async (
  contacts: Contact[],
  companyId: number
): Promise<any[]> => {
  if (!contacts.length) return [];

  const contactIds = contacts.map(c => c.id);

  const tagsMap = await getTagsForContactIds(contactIds, companyId);
  const labelsMap = await getLabelsForContactIds(contactIds, companyId);
  const assignmentsMap = await getAssignmentsForContactIds(contactIds, companyId);

  const latestTickets = await Promise.all(
    contactIds.map(cid =>
      Ticket.findOne({
        where: { contactId: cid, companyId },
        order: [["updatedAt", "DESC"]],
        attributes: ["id", "status", "updatedAt", "contactId"]
      })
    )
  );

  const lastMsgRows = await Promise.all(
    contactIds.map(cid =>
      Message.findOne({
        where: { contactId: cid, companyId },
        order: [["createdAt", "DESC"]],
        attributes: ["createdAt"]
      })
    )
  );

  const lastTicketByContact = new Map<number, LastTicketDto | null>();
  contactIds.forEach((cid, idx) => {
    const t = latestTickets[idx];
    if (!t) {
      lastTicketByContact.set(cid, null);
      return;
    }
    lastTicketByContact.set(cid, {
      id: t.id,
      status: t.status,
      updatedAt:
        t.updatedAt instanceof Date
          ? t.updatedAt.toISOString()
          : String(t.updatedAt)
    });
  });

  const lastInteractionByContact = new Map<number, string | null>();
  contactIds.forEach((cid, idx) => {
    const ticketRow = latestTickets[idx];
    const msgRow = lastMsgRows[idx];
    const ticketAt = ticketRow?.updatedAt
      ? new Date(ticketRow.updatedAt).getTime()
      : 0;
    const msgAt = msgRow?.createdAt
      ? new Date(msgRow.createdAt).getTime()
      : 0;
    if (!ticketAt && !msgAt) {
      lastInteractionByContact.set(cid, null);
      return;
    }
    lastInteractionByContact.set(
      cid,
      new Date(Math.max(ticketAt, msgAt)).toISOString()
    );
  });

  return contacts.map(c => {
    const plain = c.toJSON();
    return {
      ...plain,
      tags: tagsMap.get(c.id) ?? [],
      labels: labelsMap.get(c.id) ?? [],
      assignments: assignmentsMap.get(c.id) ?? [],
      lastTicket: lastTicketByContact.get(c.id) ?? null,
      lastInteractionAt: lastInteractionByContact.get(c.id) ?? null
    };
  });
};

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  limit: limitParam,
  companyId,
  tagId,
  labelId,
  dateFrom,
  dateTo,
  accessUser
}: Request): Promise<{
  contacts: any[];
  count: number;
  hasMore: boolean;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  const { page, limit, offset } = parsePageLimit(pageNumber, limitParam);
  const whereClause: any = {
    companyId: {
      [Op.eq]: companyId
    }
  };

  const trimmed = searchParam.trim();
  if (trimmed) {
    const sp = trimmed.toLowerCase();
    whereClause[Op.or] = [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("name")),
          "LIKE",
          `%${sp}%`
        )
      },
      { number: { [Op.like]: `%${trimmed}%` } },
      {
        email: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("email")),
          "LIKE",
          `%${sp}%`
        )
      },
      {
        notes: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("notes")),
          "LIKE",
          `%${sp}%`
        )
      }
    ];
  }

  if (dateFrom || dateTo) {
    whereClause.updatedAt = {};
    if (dateFrom) {
      whereClause.updatedAt[Op.gte] = new Date(dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      whereClause.updatedAt[Op.lte] = end;
    }
  }

  if (labelId) {
    const relRows = await ContactLabelRelation.findAll({
      where: { labelId: Number(labelId), companyId },
      attributes: ["contactId"]
    });
    const allowedContactIds = [...new Set(relRows.map((r) => r.contactId))];
    if (!allowedContactIds.length) {
      return emptyListResult(page, limit);
    }
    whereClause.id = { [Op.in]: allowedContactIds };
  }

  if (tagId) {
    const ttRows = await TicketTag.findAll({
      where: { tagId: Number(tagId) },
      attributes: ["ticketId"]
    });
    const ticketIds = ttRows.map(x => x.ticketId);
    if (!ticketIds.length) {
      return emptyListResult(page, limit);
    }
    const tickets = await Ticket.findAll({
      where: { id: { [Op.in]: ticketIds }, companyId },
      attributes: ["contactId"]
    });
    const allowedContactIds = [...new Set(tickets.map(t => t.contactId))];
    if (!allowedContactIds.length) {
      return emptyListResult(page, limit);
    }
    whereClause.id = { [Op.in]: allowedContactIds };
  }

  let finalWhere = whereClause;
  if (accessUser && !canViewAllCompanyContacts(accessUser)) {
    finalWhere = await applyContactVisibilityFilter(
      whereClause,
      Number(accessUser.id),
      companyId
    );
  }

  const { count, rows: contactRows } = await Contact.findAndCountAll({
    where: finalWhere,
    limit,
    offset,
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"]
    ]
  });

  const contacts = await enrichContacts(contactRows, companyId);

  const hasMore = count > offset + contactRows.length;
  const totalPages = count > 0 ? Math.ceil(count / limit) : 0;

  return {
    contacts,
    count,
    hasMore,
    page,
    limit,
    totalPages
  };
};

export default ListContactsService;
