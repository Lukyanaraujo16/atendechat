import { Op, WhereOptions } from "sequelize";
import Contact from "../../../../models/Contact";
import Ticket from "../../../../models/Ticket";
import Message from "../../../../models/Message";
import Queue from "../../../../models/Queue";
import User from "../../../../models/User";
import Tag from "../../../../models/Tag";
import TicketTag from "../../../../models/TicketTag";
import getTagsForContactIds from "../../../ContactServices/getTagsForContactIds";
import { resolveToolPagination, maskPhone } from "../toolPagination";

export type ContactSnapshot = {
  id: number;
  name: string;
  phoneMasked: string | null;
  email: string | null;
  tags: Array<{ name: string; color?: string }>;
  channel?: string | null;
};

export type TicketSnapshot = {
  id: number;
  status: string;
  queueName: string | null;
  assigneeName: string | null;
  contactName: string | null;
  lastMessagePreview: string | null;
  updatedAt: string | null;
  tags: Array<{ name: string }>;
};

export async function queryContactsForTool(input: {
  companyId: number;
  name?: string;
  phone?: string;
  email?: string;
  tagName?: string;
  limit?: unknown;
  offset?: unknown;
}): Promise<{ items: ContactSnapshot[]; count: number; hasMore: boolean }> {
  const { limit, offset } = resolveToolPagination({
    limit: input.limit,
    offset: input.offset
  });

  const where: WhereOptions = { companyId: input.companyId };
  const and: WhereOptions[] = [];

  if (input.name) {
    and.push({ name: { [Op.like]: `%${String(input.name).slice(0, 100)}%` } });
  }
  if (input.phone) {
    const digits = String(input.phone).replace(/\D/g, "").slice(0, 20);
    if (digits) and.push({ number: { [Op.like]: `%${digits}%` } });
  }
  if (input.email) {
    and.push({
      email: { [Op.like]: `%${String(input.email).slice(0, 120).toLowerCase()}%` }
    });
  }

  let contactIdFilter: number[] | null = null;
  if (input.tagName) {
    const tag = await Tag.findOne({
      where: {
        companyId: input.companyId,
        name: { [Op.like]: `%${String(input.tagName).slice(0, 80)}%` }
      },
      attributes: ["id"]
    });
    if (!tag) {
      return { items: [], count: 0, hasMore: false };
    }
    const ticketTags = await TicketTag.findAll({
      where: { tagId: tag.id },
      attributes: ["ticketId"]
    });
    const ticketIds = ticketTags.map(t => t.ticketId);
    if (!ticketIds.length) return { items: [], count: 0, hasMore: false };
    const tickets = await Ticket.findAll({
      where: { companyId: input.companyId, id: { [Op.in]: ticketIds } },
      attributes: ["contactId"]
    });
    contactIdFilter = [...new Set(tickets.map(t => t.contactId).filter(Boolean))];
    if (!contactIdFilter.length) return { items: [], count: 0, hasMore: false };
    and.push({ id: { [Op.in]: contactIdFilter } });
  }

  const finalWhere =
    and.length > 0 ? { [Op.and]: [where, ...and] } : where;

  const { rows, count } = await Contact.findAndCountAll({
    where: finalWhere,
    attributes: ["id", "name", "number", "email", "channel"],
    order: [["name", "ASC"], ["id", "ASC"]],
    limit,
    offset
  });

  const tagsMap = await getTagsForContactIds(
    rows.map(r => r.id),
    input.companyId
  );

  const items: ContactSnapshot[] = rows.map(c => ({
    id: c.id,
    name: c.name,
    phoneMasked: maskPhone(c.number),
    email: c.email || null,
    tags: (tagsMap.get(c.id) || []).map(t => ({
      name: t.name,
      color: t.color
    })),
    channel: c.channel || null
  }));

  return {
    items,
    count,
    hasMore: offset + rows.length < count
  };
}

export async function queryContactByIdForTool(input: {
  companyId: number;
  contactId: number;
}): Promise<ContactSnapshot | null> {
  const contact = await Contact.findOne({
    where: { id: input.contactId, companyId: input.companyId },
    attributes: ["id", "name", "number", "email", "channel"]
  });
  if (!contact) return null;
  const tagsMap = await getTagsForContactIds([contact.id], input.companyId);
  return {
    id: contact.id,
    name: contact.name,
    phoneMasked: maskPhone(contact.number),
    email: contact.email || null,
    tags: (tagsMap.get(contact.id) || []).map(t => ({
      name: t.name,
      color: t.color
    })),
    channel: contact.channel || null
  };
}

export async function queryTicketsForTool(input: {
  companyId: number;
  status?: string;
  queueId?: number;
  userId?: number;
  contactId?: number;
  limit?: unknown;
  offset?: unknown;
}): Promise<{ items: TicketSnapshot[]; count: number; hasMore: boolean }> {
  const { limit, offset } = resolveToolPagination({
    limit: input.limit,
    offset: input.offset
  });

  const where: WhereOptions = { companyId: input.companyId };
  if (input.status) where.status = String(input.status).slice(0, 32);
  if (input.queueId && Number.isFinite(input.queueId)) {
    where.queueId = Number(input.queueId);
  }
  if (input.userId && Number.isFinite(input.userId)) {
    where.userId = Number(input.userId);
  }
  if (input.contactId && Number.isFinite(input.contactId)) {
    where.contactId = Number(input.contactId);
  }

  const { rows, count } = await Ticket.findAndCountAll({
    where,
    attributes: [
      "id",
      "status",
      "queueId",
      "userId",
      "contactId",
      "lastMessage",
      "updatedAt"
    ],
    include: [
      { model: Queue, as: "queue", attributes: ["id", "name"], required: false },
      { model: User, as: "user", attributes: ["id", "name"], required: false },
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name"],
        required: false
      }
    ],
    order: [["updatedAt", "DESC"], ["id", "DESC"]],
    limit,
    offset,
    distinct: true
  });

  const ticketIds = rows.map(t => t.id);
  const tagRows = ticketIds.length
    ? await TicketTag.findAll({
        where: { ticketId: { [Op.in]: ticketIds } },
        include: [
          {
            model: Tag,
            where: { companyId: input.companyId },
            attributes: ["name"],
            required: true
          }
        ]
      })
    : [];

  const tagsByTicket = new Map<number, Array<{ name: string }>>();
  for (const tt of tagRows) {
    const list = tagsByTicket.get(tt.ticketId) || [];
    if (tt.tag?.name) list.push({ name: tt.tag.name });
    tagsByTicket.set(tt.ticketId, list);
  }

  const items: TicketSnapshot[] = rows.map(t => {
    const plain = t as Ticket & {
      queue?: Queue | null;
      user?: User | null;
      contact?: Contact | null;
    };
    return {
      id: t.id,
      status: t.status,
      queueName: plain.queue?.name || null,
      assigneeName: plain.user?.name || null,
      contactName: plain.contact?.name || null,
      lastMessagePreview: t.lastMessage
        ? String(t.lastMessage).slice(0, 160)
        : null,
      updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
      tags: tagsByTicket.get(t.id) || []
    };
  });

  return {
    items,
    count,
    hasMore: offset + rows.length < count
  };
}

export async function queryTicketByIdForTool(input: {
  companyId: number;
  ticketId: number;
}): Promise<TicketSnapshot | null> {
  const ticket = await Ticket.findOne({
    where: { id: input.ticketId, companyId: input.companyId },
    attributes: [
      "id",
      "status",
      "queueId",
      "userId",
      "contactId",
      "lastMessage",
      "updatedAt"
    ],
    include: [
      { model: Queue, as: "queue", attributes: ["id", "name"], required: false },
      { model: User, as: "user", attributes: ["id", "name"], required: false },
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name"],
        required: false
      }
    ]
  });
  if (!ticket) return null;

  const tagRows = await TicketTag.findAll({
    where: { ticketId: ticket.id },
    include: [
      {
        model: Tag,
        where: { companyId: input.companyId },
        attributes: ["name"],
        required: true
      }
    ]
  });

  const plain = ticket as Ticket & {
    queue?: Queue | null;
    user?: User | null;
    contact?: Contact | null;
  };

  let lastPreview = ticket.lastMessage
    ? String(ticket.lastMessage).slice(0, 160)
    : null;
  if (!lastPreview) {
    const msg = await Message.findOne({
      where: { ticketId: ticket.id, companyId: input.companyId },
      order: [["createdAt", "DESC"]],
      attributes: ["body"]
    });
    lastPreview = msg?.body ? String(msg.body).slice(0, 160) : null;
  }

  return {
    id: ticket.id,
    status: ticket.status,
    queueName: plain.queue?.name || null,
    assigneeName: plain.user?.name || null,
    contactName: plain.contact?.name || null,
    lastMessagePreview: lastPreview,
    updatedAt: ticket.updatedAt
      ? new Date(ticket.updatedAt).toISOString()
      : null,
    tags: tagRows.map(t => ({ name: t.tag?.name || "" })).filter(t => t.name)
  };
}

export async function queryQueuesForTool(input: {
  companyId: number;
  limit?: unknown;
  offset?: unknown;
}): Promise<{
  items: Array<{ id: number; name: string; color: string | null }>;
  count: number;
  hasMore: boolean;
}> {
  const { limit, offset } = resolveToolPagination({
    limit: input.limit,
    offset: input.offset
  });
  const { rows, count } = await Queue.findAndCountAll({
    where: { companyId: input.companyId },
    attributes: ["id", "name", "color"],
    order: [["name", "ASC"]],
    limit,
    offset
  });
  return {
    items: rows.map(q => ({
      id: q.id,
      name: q.name,
      color: q.color || null
    })),
    count,
    hasMore: offset + rows.length < count
  };
}

export async function queryUsersForTool(input: {
  companyId: number;
  limit?: unknown;
  offset?: unknown;
  search?: string;
}): Promise<{
  items: Array<{ id: number; name: string; profile: string; online: boolean }>;
  count: number;
  hasMore: boolean;
}> {
  const { limit, offset } = resolveToolPagination({
    limit: input.limit,
    offset: input.offset
  });
  const where: WhereOptions = { companyId: input.companyId };
  if (input.search) {
    (where as any).name = {
      [Op.like]: `%${String(input.search).slice(0, 80)}%`
    };
  }
  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: ["id", "name", "profile", "online"],
    order: [["name", "ASC"]],
    limit,
    offset
  });
  return {
    items: rows.map(u => ({
      id: u.id,
      name: u.name,
      profile: u.profile,
      online: Boolean(u.online)
    })),
    count,
    hasMore: offset + rows.length < count
  };
}
