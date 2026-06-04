import { Request } from "express";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { isGroupTicket } from "./groupTicketRules";
import {
  assertWhatsappTicketAccess,
  canUserAccessTicketByWhatsapp,
  isWhatsappTicketVisibilityPrivileged,
  loadWhatsappTicketVisibility,
  normalizeWhatsappTicketVisibility
} from "./whatsappTicketVisibility";
import {
  assertUserCanAccessGroupContact,
  isGroupVisibilityPrivileged
} from "./groupVisibility";
import Contact from "../models/Contact";
import type { TicketAccessTicket, TicketAccessUser } from "./ticketAccess";

export const GROUP_TICKET_ACCESS_DEBUG_PREFIX = "[GroupTicketAccessDebug]";

export function logGroupTicketAccessDebug(
  endpoint: string,
  phase: string,
  payload: Record<string, unknown>
): void {
  logger.info(
    {
      endpoint,
      phase,
      ...payload
    },
    GROUP_TICKET_ACCESS_DEBUG_PREFIX
  );
}

export function logGroupTicketAccessDebugError(
  endpoint: string,
  phase: string,
  error: unknown,
  payload: Record<string, unknown> = {}
): void {
  const formatted = formatThrownError(error);
  logger.error(
    {
      endpoint,
      phase,
      ...payload,
      ...formatted
    },
    GROUP_TICKET_ACCESS_DEBUG_PREFIX
  );
}

export function formatThrownError(error: unknown): {
  errorMessage: string;
  errorStatusCode?: number;
  errorStack?: string;
} {
  if (error instanceof AppError) {
    return {
      errorMessage: error.message,
      errorStatusCode: error.statusCode,
      errorStack: error instanceof Error ? error.stack : undefined
    };
  }
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorStack: error.stack
    };
  }
  return { errorMessage: String(error) };
}

export function serializeReqUserForDebug(
  user: Request["user"] | undefined
): Record<string, unknown> {
  if (!user) return { user: null };
  return {
    userId: user.id,
    profile: user.profile,
    companyId: user.companyId,
    companyIdType: typeof user.companyId,
    supportMode: user.supportMode,
    supportHomeCompanyId: (user as { supportHomeCompanyId?: number | null })
      .supportHomeCompanyId
  };
}

export function serializeTicketForAccessDebug(
  ticket: {
    id?: number;
    uuid?: string;
    companyId?: number;
    status?: string;
    isGroup?: boolean | number | string | null;
    contactId?: number | string | null;
    contact?: {
      id?: number;
      isGroup?: boolean | number | string | null;
      groupVisible?: boolean | null;
      companyId?: number;
    } | null;
    whatsappId?: number | string | null;
    whatsapp?: { ticketVisibility?: string | null; status?: string | null } | null;
    queueId?: number | string | null;
    userId?: number | string | null;
  } | null | undefined
): Record<string, unknown> {
  if (!ticket) {
    return { ticket: null };
  }
  return {
    ticketId: ticket.id,
    ticketUuid: ticket.uuid,
    ticketCompanyId: ticket.companyId,
    ticketCompanyIdType: typeof ticket.companyId,
    ticketStatus: ticket.status,
    ticketIsGroup: ticket.isGroup,
    ticketContactId: ticket.contactId,
    contactId: ticket.contact?.id,
    contactIsGroup: ticket.contact?.isGroup,
    contactGroupVisible: ticket.contact?.groupVisible,
    contactCompanyId: ticket.contact?.companyId,
    whatsappId: ticket.whatsappId,
    whatsappTicketVisibility: ticket.whatsapp?.ticketVisibility,
    whatsappStatus: ticket.whatsapp?.status,
    queueId: ticket.queueId,
    userId: ticket.userId,
    isGroupTicketResult: isGroupTicket(ticket)
  };
}

export function snapshotTicketIncludes(
  ticket: {
    contact?: unknown;
    whatsapp?: unknown;
    queue?: unknown;
    user?: unknown;
  } | null | undefined
): Record<string, boolean> {
  return {
    includesContact: Boolean(ticket?.contact),
    includesWhatsapp: Boolean(ticket?.whatsapp),
    includesQueue: Boolean(ticket?.queue),
    includesUser: Boolean(ticket?.user)
  };
}

export async function probeWhatsappTicketAccess(
  ticket: TicketAccessTicket,
  user: TicketAccessUser,
  companyId: number
): Promise<Record<string, unknown>> {
  let visibility = ticket.whatsapp?.ticketVisibility;
  if (visibility == null && ticket.whatsappId != null) {
    visibility = await loadWhatsappTicketVisibility(
      Number(ticket.whatsappId),
      companyId
    );
  } else {
    visibility = normalizeWhatsappTicketVisibility(visibility);
  }

  const privileged = isWhatsappTicketVisibilityPrivileged(user);
  const canByRule = canUserAccessTicketByWhatsapp(visibility, user);

  try {
    await assertWhatsappTicketAccess(ticket, user, companyId);
    return {
      assertWhatsappTicketAccess: "allowed",
      ticketVisibility: visibility,
      whatsappPrivileged: privileged,
      canUserAccessTicketByWhatsapp: canByRule
    };
  } catch (error) {
    return {
      assertWhatsappTicketAccess: "denied",
      ticketVisibility: visibility,
      whatsappPrivileged: privileged,
      canUserAccessTicketByWhatsapp: canByRule,
      ...formatThrownError(error)
    };
  }
}

export async function probeGroupContactAccess(
  contact: Contact,
  user: TicketAccessUser,
  companyId: number
): Promise<Record<string, unknown>> {
  const privileged = isGroupVisibilityPrivileged({
    id: user.id,
    profile: user.profile,
    supportMode: user.supportMode,
    companyId
  });

  try {
    await assertUserCanAccessGroupContact(contact, {
      id: user.id,
      profile: user.profile,
      supportMode: user.supportMode,
      companyId
    });
    return {
      assertUserCanAccessGroupContact: "allowed",
      groupVisibilityPrivileged: privileged,
      contactCompanyId: contact.companyId,
      contactCompanyIdOnModel: contact.companyId,
      actorCompanyId: companyId,
      contactIsGroup: contact.isGroup,
      contactGroupVisible: contact.groupVisible
    };
  } catch (error) {
    return {
      assertUserCanAccessGroupContact: "denied",
      groupVisibilityPrivileged: privileged,
      contactCompanyId: contact.companyId,
      contactCompanyIdOnModel: contact.companyId,
      actorCompanyId: companyId,
      contactIsGroup: contact.isGroup,
      contactGroupVisible: contact.groupVisible,
      denyHint:
        privileged && (contact.companyId == null || contact.companyId === undefined)
          ? "privileged_should_allow_after_fix"
          : undefined,
      ...formatThrownError(error)
    };
  }
}

export function companyIdsMatch(
  ticketCompanyId: unknown,
  reqCompanyId: unknown
): boolean {
  const a = Number(ticketCompanyId);
  const b = Number(reqCompanyId);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }
  return a === b;
}
