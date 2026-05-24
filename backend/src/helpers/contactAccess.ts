import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import ContactAssignment from "../models/ContactAssignment";
import Ticket from "../models/Ticket";

export type ContactAccessUser = {
  id?: number | string;
  profile?: string;
  supportMode?: boolean;
  super?: boolean;
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
  const profile = String(user.profile || "");
  return profile === "admin" || profile === "supervisor";
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
 * Contatos com ticket atribuído explicitamente ao usuário (Ticket.userId).
 * Não inclui pending na fila sem atendente — diferente da inbox.
 */
export async function getContactIdsFromUserAssignedTickets(
  userId: number,
  companyId: number
): Promise<number[]> {
  const rows = await Ticket.findAll({
    where: {
      companyId,
      userId,
      contactId: { [Op.not]: null }
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

/**
 * IDs visíveis para usuário comum:
 * - ContactAssignment explícito;
 * - ticket com userId = usuário (aceite, transferência, atendimento, finalizado).
 */
export async function getVisibleContactIdsForUser(
  userId: number,
  companyId: number
): Promise<number[]> {
  const [assignedIds, ticketContactIds] = await Promise.all([
    getAssignedContactIdsForUser(userId, companyId),
    getContactIdsFromUserAssignedTickets(userId, companyId)
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

  const visibleIds = await getVisibleContactIdsForUser(uid, companyId);
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
  const visibleIds = await getVisibleContactIdsForUser(userId, companyId);
  return applyAssignedContactFilter(whereClause, visibleIds);
}
