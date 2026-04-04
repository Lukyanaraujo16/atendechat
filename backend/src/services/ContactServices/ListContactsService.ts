import { Sequelize, Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import TicketTag from "../../models/TicketTag";
import getTagsForContactIds from "./getTagsForContactIds";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
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
      lastTicket: lastTicketByContact.get(c.id) ?? null,
      lastInteractionAt: lastInteractionByContact.get(c.id) ?? null
    };
  });
};

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  tagId,
  dateFrom,
  dateTo
}: Request): Promise<{
  contacts: any[];
  count: number;
  hasMore: boolean;
}> => {
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

  if (tagId) {
    const ttRows = await TicketTag.findAll({
      where: { tagId: Number(tagId) },
      attributes: ["ticketId"]
    });
    const ticketIds = ttRows.map(x => x.ticketId);
    if (!ticketIds.length) {
      return { contacts: [], count: 0, hasMore: false };
    }
    const tickets = await Ticket.findAll({
      where: { id: { [Op.in]: ticketIds }, companyId },
      attributes: ["contactId"]
    });
    const allowedContactIds = [...new Set(tickets.map(t => t.contactId))];
    if (!allowedContactIds.length) {
      return { contacts: [], count: 0, hasMore: false };
    }
    whereClause.id = { [Op.in]: allowedContactIds };
  }

  const limit = 30;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: contactRows } = await Contact.findAndCountAll({
    where: whereClause,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  const contacts = await enrichContacts(contactRows, companyId);

  const hasMore = count > offset + contactRows.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
