import { isTruthyGroupFlag } from "./isGroupTicket";

/**
 * Espelha `ticketAccess.ts` no cliente.
 * Grupos: se o backend devolveu o ticket, confia na regra de groupVisibility já validada no servidor.
 * 1:1: userId === eu ou pool sem responsável na minha fila.
 */
export function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;

  if (
    isTruthyGroupFlag(ticket.isGroup) ||
    isTruthyGroupFlag(ticket.contact?.isGroup)
  ) {
    return true;
  }

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
    if (qid != null && !Number.isNaN(qid)) {
      const queues = Array.isArray(user.queues) ? user.queues : [];
      return queues.some((q) => Number(q.id) === qid);
    }
  }

  return false;
}
