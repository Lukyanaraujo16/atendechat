/**
 * Espelha a semântica de listagem/agência do backend (agentTicketListWhere +
 * resolveEffectiveQueueIdsForAgent + unassignedTicketsVisibility) para
 * decisão de socket/coluna no cliente.
 * selectedQueueIds é só filtro visual — nunca amplia membership.
 */

export function getMembershipQueueIds(user) {
  const queues = Array.isArray(user?.queues) ? user.queues : [];
  return queues
    .map((q) => Number(q.id))
    .filter((id) => Number.isFinite(id));
}

export function resolveEffectiveSelectedQueueIds(user, selectedQueueIds) {
  const membership = getMembershipQueueIds(user);
  const selected = Array.isArray(selectedQueueIds)
    ? selectedQueueIds.map(Number).filter((id) => Number.isFinite(id))
    : [];
  if (!selected.length) {
    return membership;
  }
  const set = new Set(membership);
  return selected.filter((id) => set.has(id));
}

/**
 * allTicket enabled OU membership contém o setor de contingência da empresa.
 */
export function canUserSeeNullQueueTickets(user) {
  if (!user) return false;
  if (user.allTicket === "enabled") return true;
  const contingencyRaw =
    user.company?.unassignedTicketsQueueId ??
    user.unassignedTicketsQueueId ??
    null;
  if (contingencyRaw == null || contingencyRaw === "") return false;
  const contingencyId = Number(contingencyRaw);
  if (!Number.isFinite(contingencyId)) return false;
  return getMembershipQueueIds(user).indexOf(contingencyId) > -1;
}

/**
 * Decide se o utilizador comum pode ver o ticket na inbox.
 * Admin/supervisor/supportMode: tratado no caller (perfil privilegiado).
 *
 * @returns {{ allowed: boolean, reason: string }}
 */
export function decideUserTicketInboxVisibility(
  user,
  ticket,
  selectedQueueIds
) {
  if (!user || !ticket) {
    return { allowed: false, reason: "missing_actor_or_ticket" };
  }

  const ticketCompanyId =
    ticket.companyId ?? ticket.contact?.companyId ?? null;
  const actorCompanyId = user.companyId ?? null;
  if (
    ticketCompanyId != null &&
    actorCompanyId != null &&
    Number(ticketCompanyId) !== Number(actorCompanyId)
  ) {
    return { allowed: false, reason: "company_mismatch" };
  }

  if (user.supportMode !== true) {
    const vis = ticket?.whatsapp?.ticketVisibility || "all";
    if (vis === "admin_supervisor") {
      return { allowed: false, reason: "whatsapp_admin_supervisor" };
    }
  }

  const myId = Number(user.id);
  const assigneeRaw = ticket.userId;
  const assignee =
    assigneeRaw != null && assigneeRaw !== ""
      ? Number(assigneeRaw)
      : null;

  if (assignee != null && !Number.isNaN(assignee) && assignee > 0) {
    if (assignee === myId) {
      return { allowed: true, reason: "own_assigned_ticket" };
    }
    return { allowed: false, reason: "assigned_to_other" };
  }

  const qidRaw = ticket.queueId;
  const qid =
    qidRaw != null && qidRaw !== "" && !Number.isNaN(Number(qidRaw))
      ? Number(qidRaw)
      : null;

  if (qid == null) {
    if (canUserSeeNullQueueTickets(user)) {
      return { allowed: true, reason: "queue_null_allowed" };
    }
    return { allowed: false, reason: "queue_null_denied" };
  }

  const effective = resolveEffectiveSelectedQueueIds(user, selectedQueueIds);
  if (effective.indexOf(qid) > -1) {
    return { allowed: true, reason: "queue_allowed" };
  }
  return { allowed: false, reason: "queue_not_allowed" };
}

export function canUserViewTicketInInbox(user, ticket, selectedQueueIds) {
  return decideUserTicketInboxVisibility(user, ticket, selectedQueueIds)
    .allowed;
}
