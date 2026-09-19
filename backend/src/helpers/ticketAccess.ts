import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import User from "../models/User";
import Queue from "../models/Queue";
import { assertUserCanAccessGroupContact } from "./groupVisibility";
import { isGroupTicket } from "./groupTicketRules";
import { logGroupTicketAccessDebug } from "./groupTicketAccessDebug";
import {
  assertWhatsappTicketAccess,
  isWhatsappTicketVisibilityPrivileged,
  loadWhatsappTicketVisibility,
  normalizeWhatsappTicketVisibility,
  WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR
} from "./whatsappTicketVisibility";
import {
  allowsNullQueueVisibility,
  loadCompanyUnassignedTicketsQueueId
} from "./unassignedTicketsVisibility";
import { isUnqueuedPendingAutomationTicket } from "./ticketAutomationState";

export type TicketAccessUser = {
  id: string | number;
  profile?: string;
  supportMode?: boolean;
};

export type TicketAccessContact = Pick<
  Contact,
  "id" | "isGroup" | "groupVisible" | "companyId"
>;

export type TicketAccessTicket = {
  userId?: number | string | null;
  queueId?: number | string | null;
  whatsappId?: number | string | null;
  companyId?: number;
  whatsapp?: { ticketVisibility?: string | null } | null;
  isGroup?: boolean | number | string | null;
  status?: string | null;
  chatbot?: boolean | null;
  contact?: TicketAccessContact | null;
  contactId?: number | string | null;
};

export function toTicketAccessPayload(ticket: {
  userId?: number | string | null;
  queueId?: number | string | null;
  whatsappId?: number | string | null;
  companyId?: number;
  whatsapp?: { ticketVisibility?: string | null } | null;
  isGroup?: boolean | number | string | null;
  status?: string | null;
  chatbot?: boolean | null;
  contact?: TicketAccessContact | null;
  contactId?: number | string | null;
}): TicketAccessTicket {
  return {
    userId: ticket.userId,
    queueId: ticket.queueId,
    whatsappId: ticket.whatsappId,
    companyId: ticket.companyId,
    whatsapp: ticket.whatsapp,
    isGroup: ticket.isGroup,
    status: ticket.status,
    chatbot: ticket.chatbot,
    contact: ticket.contact ?? null,
    contactId: ticket.contactId
  };
}

export function getUserQueueIdsFromQueues(
  queues: { id: number }[] | undefined
): number[] {
  if (!Array.isArray(queues)) return [];
  return queues.map((q) => Number(q.id)).filter((id) => Number.isFinite(id));
}

/**
 * Regra de acesso a um ticket (não-admin / sem supportMode):
 * - atribuído diretamente ao utilizador (qualquer queueId, inclusive null);
 * - ou sem responsável e queueId numa fila do utilizador;
 * - ou sem responsável, queueId null e allowNullQueueTickets
 *   (allTicket ou setor de contingência da empresa).
 */
export function canAccessTicket(
  user: TicketAccessUser,
  ticket: TicketAccessTicket,
  userQueueIds: number[] = [],
  allowNullQueueTickets = false
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
    if (
      (qid == null || Number.isNaN(qid)) &&
      allowNullQueueTickets === true
    ) {
      return true;
    }
    if (
      (qid == null || Number.isNaN(qid)) &&
      isUnqueuedPendingAutomationTicket(ticket)
    ) {
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

export async function loadUserAllTicketEnabled(
  userId: string | number
): Promise<boolean> {
  const userRow = await User.findByPk(userId, {
    attributes: ["allTicket"]
  });
  return userRow?.allTicket === "enabled";
}

export async function resolveAllowNullQueueTickets(
  userId: string | number,
  companyId: number,
  userQueueIds?: number[]
): Promise<boolean> {
  const [queues, allTicketEnabled, contingencyQueueId] = await Promise.all([
    userQueueIds != null
      ? Promise.resolve(userQueueIds)
      : loadUserQueueIds(userId),
    loadUserAllTicketEnabled(userId),
    loadCompanyUnassignedTicketsQueueId(companyId)
  ]);
  return allowsNullQueueVisibility(
    queues,
    allTicketEnabled,
    contingencyQueueId
  );
}

async function resolveGroupContactForAccess(
  ticket: TicketAccessTicket,
  companyId: number
): Promise<Contact> {
  if (ticket.contact?.id) {
    return ticket.contact as Contact;
  }
  const contactId = ticket.contactId;
  if (contactId == null || contactId === "") {
    logGroupTicketAccessDebug("ticketAccess", "group_contact_resolve_deny", {
      denyReason: "missing_contact_and_contactId",
      companyId
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const row = await Contact.findByPk(Number(contactId), {
    attributes: ["id", "isGroup", "groupVisible", "companyId"]
  });
  if (!row || !isGroupTicket({ contact: row })) {
    logGroupTicketAccessDebug("ticketAccess", "group_contact_resolve_deny", {
      denyReason: "contact_not_found_or_not_group",
      companyId,
      contactId: Number(contactId),
      rowFound: Boolean(row),
      rowIsGroup: row?.isGroup
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  if (Number(row.companyId) !== Number(companyId)) {
    logGroupTicketAccessDebug("ticketAccess", "group_contact_resolve_deny", {
      denyReason: "contact_company_mismatch",
      companyId,
      contactCompanyId: row.companyId
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  return row;
}

/**
 * Único gate de acesso a ticket/recurso ligado ao ticket.
 * Grupo: whatsappTicketVisibility + groupVisibility (sem userId/queueId).
 * 1:1: regra de fila/atendente.
 */
export async function assertUserCanAccessTicketResource(
  user: TicketAccessUser,
  ticket: TicketAccessTicket,
  companyId?: number,
  debugEndpoint = "ticketAccess"
): Promise<void> {
  const cid = companyId ?? ticket.companyId;
  const numericCid = cid != null ? Number(cid) : NaN;

  logGroupTicketAccessDebug(debugEndpoint, "assert_enter", {
    userId: user.id,
    profile: user.profile,
    supportMode: user.supportMode,
    reqCompanyId: companyId,
    ticketCompanyId: ticket.companyId,
    isGroupTicket: isGroupTicket(ticket),
    ticketIsGroupFlag: ticket.isGroup,
    contactPresent: Boolean(ticket.contact?.id),
    contactIsGroup: ticket.contact?.isGroup,
    whatsappTicketVisibility: ticket.whatsapp?.ticketVisibility,
    ticketUserId: ticket.userId,
    ticketQueueId: ticket.queueId
  });

  if (cid == null || !Number.isFinite(numericCid)) {
    logGroupTicketAccessDebug(debugEndpoint, "assert_deny", {
      branch: "precheck",
      denyReason: "missing_company_context",
      cid
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  try {
    await assertWhatsappTicketAccess(ticket, user, numericCid);
    logGroupTicketAccessDebug(debugEndpoint, "assert_whatsapp", {
      branch: "whatsapp",
      result: "allowed"
    });
  } catch (error) {
    logGroupTicketAccessDebug(debugEndpoint, "assert_deny", {
      branch: "whatsapp",
      denyReason: "assertWhatsappTicketAccess",
      errorMessage: error instanceof AppError ? error.message : String(error)
    });
    throw error;
  }

  if (isGroupTicket(ticket)) {
    logGroupTicketAccessDebug(debugEndpoint, "assert_branch", {
      branch: "group"
    });
    const contact = await resolveGroupContactForAccess(ticket, numericCid);
    try {
      await assertUserCanAccessGroupContact(contact, {
        id: user.id,
        profile: user.profile,
        supportMode: user.supportMode,
        companyId: numericCid
      });
      logGroupTicketAccessDebug(debugEndpoint, "assert_allow", {
        branch: "group",
        result: "allowed"
      });
    } catch (error) {
      logGroupTicketAccessDebug(debugEndpoint, "assert_deny", {
        branch: "group",
        denyReason: "assertUserCanAccessGroupContact",
        errorMessage: error instanceof AppError ? error.message : String(error)
      });
      throw error;
    }
    return;
  }

  logGroupTicketAccessDebug(debugEndpoint, "assert_branch", {
    branch: "normal"
  });

  let visibility = ticket.whatsapp?.ticketVisibility;
  if (visibility == null && ticket.whatsappId != null) {
    visibility = await loadWhatsappTicketVisibility(
      Number(ticket.whatsappId),
      numericCid
    );
  } else {
    visibility = normalizeWhatsappTicketVisibility(visibility);
  }

  if (
    isWhatsappTicketVisibilityPrivileged(user) &&
    visibility === WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR
  ) {
    logGroupTicketAccessDebug(debugEndpoint, "assert_allow", {
      branch: "normal",
      denyReason: null,
      subReason: "privileged_restricted_whatsapp"
    });
    return;
  }

  if (canAccessTicket(user, ticket, [])) {
    logGroupTicketAccessDebug(debugEndpoint, "assert_allow", {
      branch: "normal",
      subReason: "canAccessTicket_without_queues"
    });
    return;
  }

  const userQueueIds = await loadUserQueueIds(user.id);
  const allowNullQueueTickets = await resolveAllowNullQueueTickets(
    user.id,
    numericCid,
    userQueueIds
  );
  if (!canAccessTicket(user, ticket, userQueueIds, allowNullQueueTickets)) {
    logGroupTicketAccessDebug(debugEndpoint, "assert_deny", {
      branch: "normal",
      denyReason: "canAccessTicket_failed",
      userQueueIds,
      allowNullQueueTickets,
      ticketUserId: ticket.userId,
      ticketQueueId: ticket.queueId,
      profile: user.profile,
      supportMode: user.supportMode
    });
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  logGroupTicketAccessDebug(debugEndpoint, "assert_allow", {
    branch: "normal",
    subReason: "canAccessTicket_with_queues",
    userQueueIds,
    allowNullQueueTickets
  });
}

/** @deprecated Preferir assertUserCanAccessTicketResource */
export const assertTicketAccess = assertUserCanAccessTicketResource;
