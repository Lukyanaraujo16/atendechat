import AppError from "../errors/AppError";
import User from "../models/User";
import Queue from "../models/Queue";
import {
  assertWhatsappTicketAccess,
  isWhatsappTicketVisibilityPrivileged,
  loadWhatsappTicketVisibility,
  normalizeWhatsappTicketVisibility,
  WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR
} from "./whatsappTicketVisibility";

export type TicketAccessUser = {
  id: string | number;
  profile?: string;
  supportMode?: boolean;
};

export type TicketAccessTicket = {
  userId?: number | string | null;
  queueId?: number | string | null;
  whatsappId?: number | string | null;
  companyId?: number;
  whatsapp?: { ticketVisibility?: string | null } | null;
};

export function getUserQueueIdsFromQueues(
  queues: { id: number }[] | undefined
): number[] {
  if (!Array.isArray(queues)) return [];
  return queues.map((q) => Number(q.id)).filter((id) => Number.isFinite(id));
}

/**
 * Regra de acesso a um ticket (não-admin / sem supportMode):
 * - atribuído diretamente ao utilizador (qualquer queueId, inclusive null);
 * - ou sem responsável e queueId numa fila do utilizador.
 */
export function canAccessTicket(
  user: TicketAccessUser,
  ticket: TicketAccessTicket,
  userQueueIds: number[] = []
): boolean {
  if (user.profile === "admin" || user.supportMode === true) {
    return true;
  }

  const me = Number(user.id);
  const assigneeRaw = ticket.userId;
  const assignee =
    assigneeRaw != null && assigneeRaw !== ""
      ? Number(assigneeRaw)
      : null;

  if (assignee != null && !Number.isNaN(assignee) && assignee === me) {
    return true;
  }

  if (assignee == null) {
    const qidRaw = ticket.queueId;
    const qid =
      qidRaw != null && qidRaw !== "" ? Number(qidRaw) : null;
    if (qid != null && !Number.isNaN(qid) && userQueueIds.includes(qid)) {
      return true;
    }
  }

  return false;
}

export async function loadUserQueueIds(
  userId: string | number
): Promise<number[]> {
  const userRow = await User.findByPk(userId, {
    attributes: ["id"],
    include: [{ model: Queue, as: "queues", attributes: ["id"] }]
  });
  return getUserQueueIdsFromQueues(userRow?.queues);
}

export async function assertTicketAccess(
  user: TicketAccessUser,
  ticket: TicketAccessTicket,
  companyId?: number
): Promise<void> {
  const cid = companyId ?? ticket.companyId;
  if (cid == null) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await assertWhatsappTicketAccess(ticket, user, Number(cid));

  let visibility = ticket.whatsapp?.ticketVisibility;
  if (visibility == null && ticket.whatsappId != null) {
    visibility = await loadWhatsappTicketVisibility(
      Number(ticket.whatsappId),
      Number(cid)
    );
  } else {
    visibility = normalizeWhatsappTicketVisibility(visibility);
  }

  if (
    isWhatsappTicketVisibilityPrivileged(user) &&
    visibility === WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR
  ) {
    return;
  }

  if (canAccessTicket(user, ticket, [])) {
    return;
  }

  const userQueueIds = await loadUserQueueIds(user.id);
  if (!canAccessTicket(user, ticket, userQueueIds)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
}
