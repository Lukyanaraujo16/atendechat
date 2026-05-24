import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import ContactAssignment from "../models/ContactAssignment";
import Ticket from "../models/Ticket";
import User from "../models/User";
import Queue from "../models/Queue";
import { buildNonAdminTicketListWhere } from "./agentTicketListWhere";

export type ContactAccessUser = {
  id?: number | string;
  profile?: string;
  supportMode?: boolean;
  super?: boolean;
};

export type UserContactScope = {
  queueIds: number[];
  allTicketEnabled: boolean;
};

export function canViewAllCompanyContacts(user: ContactAccessUser): boolean {
  if (user.super === true) return true;
  if (user.supportMode === true) return true;
  const profile = String(user.profile || "");
  return profile === "admin" || profile === "supervisor";
}

export function canManageContactAssignments(user: ContactAccessUser): boolean {
  if (user.super === true) return true;
  if (user.supportMode === true) return true;
  return String(user.profile || "") === "admin";
}

export async function loadUserContactScope(
  userId: number,
  companyId: number
): Promise<UserContactScope> {
  const user = await User.findByPk(userId, {
    attributes: ["id", "allTicket"],
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id"],
        through: { attributes: [] }
      }
    ]
  });

  const queueIds = (user?.queues ?? [])
    .map((q) => Number(q.id))
    .filter((id) => Number.isFinite(id));

  return {
    queueIds,
    allTicketEnabled: user?.allTicket === "enabled"
  };
}

/** Contatos com ticket visível na inbox do atendente (mesma regra de filas/allTicket). */
export async function getContactIdsFromAccessibleTickets(
  userId: number,
  companyId: number,
  scope: UserContactScope
): Promise<number[]> {
  const ticketWhere = buildNonAdminTicketListWhere(
    userId,
    scope.queueIds,
    scope.allTicketEnabled
  );

  const rows = await Ticket.findAll({
    where: {
      companyId,
      ...(ticketWhere as Record<string, unknown>)
    },
    attributes: ["contactId"],
    group: ["contactId"]
  });

  return [
    ...new Set(
      rows
        .map((r) => Number(r.contactId))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  ];
}

export async function getAssignedContactIdsForUser(
  userId: number,
  companyId: number
): Promise<number[]> {
  const rows = await ContactAssignment.findAll({
    where: { userId, companyId },
    attributes: ["contactId"]
  });
  return [...new Set(rows.map((r) => r.contactId))];
}

/**
 * IDs visíveis para usuário comum:
 * - responsável explícito (ContactAssignment);
 * - ticket atribuído ao usuário ou pending na fila dele (allTicket respeitado).
 */
export async function getVisibleContactIdsForUser(
  userId: number,
  companyId: number,
  scope?: UserContactScope
): Promise<number[]> {
  const resolvedScope = scope ?? (await loadUserContactScope(userId, companyId));
  const [assignedIds, ticketContactIds] = await Promise.all([
    getAssignedContactIdsForUser(userId, companyId),
    getContactIdsFromAccessibleTickets(userId, companyId, resolvedScope)
  ]);

  return [...new Set([...assignedIds, ...ticketContactIds])];
}

export async function userHasContactAssignment(
  contactId: number,
  userId: number,
  companyId: number
): Promise<boolean> {
  const row = await ContactAssignment.findOne({
    where: { contactId, userId, companyId }
  });
  return Boolean(row);
}

export async function userCanAccessContact(
  contactId: number,
  companyId: number,
  user: ContactAccessUser
): Promise<boolean> {
  if (canViewAllCompanyContacts(user)) {
    return true;
  }

  const uid = Number(user.id);
  if (!Number.isFinite(uid)) {
    return false;
  }

  const scope = await loadUserContactScope(uid, companyId);
  const visibleIds = await getVisibleContactIdsForUser(uid, companyId, scope);
  return visibleIds.includes(Number(contactId));
}

export async function assertUserCanAccessContact(
  contactId: number,
  companyId: number,
  user: ContactAccessUser
): Promise<Contact> {
  const contact = await Contact.findByPk(contactId);
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }
  if (contact.companyId !== companyId) {
    throw new AppError("Não é possível acessar registro de outra empresa", 403);
  }

  if (canViewAllCompanyContacts(user)) {
    return contact;
  }

  const canAccess = await userCanAccessContact(contact.id, companyId, user);
  if (!canAccess) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return contact;
}

export function applyAssignedContactFilter(
  whereClause: Record<string, unknown>,
  visibleContactIds: number[]
): Record<string, unknown> {
  if (!visibleContactIds.length) {
    return { ...whereClause, id: { [Op.in]: [-1] } };
  }
  const existingId = whereClause.id as { [Op.in]?: number[] } | undefined;
  if (existingId && existingId[Op.in]) {
    const intersection = existingId[Op.in].filter((id) =>
      visibleContactIds.includes(id)
    );
    return {
      ...whereClause,
      id: { [Op.in]: intersection.length ? intersection : [-1] }
    };
  }
  return { ...whereClause, id: { [Op.in]: visibleContactIds } };
}

export async function applyContactVisibilityFilter(
  whereClause: Record<string, unknown>,
  userId: number,
  companyId: number
): Promise<Record<string, unknown>> {
  const scope = await loadUserContactScope(userId, companyId);
  const visibleIds = await getVisibleContactIdsForUser(userId, companyId, scope);
  return applyAssignedContactFilter(whereClause, visibleIds);
}
