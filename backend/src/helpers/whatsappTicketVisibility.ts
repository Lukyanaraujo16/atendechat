import { Op, literal, Filterable } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import User from "../models/User";
import AppError from "../errors/AppError";
import {
  buildNonAdminTicketListWhere,
  queueInAllowedOrUnassigned
} from "./agentTicketListWhere";

export const WHATSAPP_TICKET_VISIBILITY_ALL = "all";
export const WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR = "admin_supervisor";

/** Reservado para evolução futura. */
export const WHATSAPP_TICKET_VISIBILITY_SPECIFIC_USERS = "specific_users";
export const WHATSAPP_TICKET_VISIBILITY_SPECIFIC_QUEUES = "specific_queues";

export type WhatsappTicketVisibilityActor = {
  id?: string | number;
  profile?: string;
  supportMode?: boolean;
};

export function normalizeWhatsappTicketVisibility(
  value: string | null | undefined
): string {
  const v = String(value ?? "").trim();
  if (v === WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR) {
    return WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR;
  }
  return WHATSAPP_TICKET_VISIBILITY_ALL;
}

export function isWhatsappTicketVisibilityPrivileged(
  actor: WhatsappTicketVisibilityActor
): boolean {
  return (
    actor.profile === "admin" ||
    actor.profile === "supervisor" ||
    actor.supportMode === true
  );
}

export function canUserAccessTicketByWhatsapp(
  ticketVisibility: string | null | undefined,
  actor: WhatsappTicketVisibilityActor
): boolean {
  if (isWhatsappTicketVisibilityPrivileged(actor)) {
    return true;
  }
  return (
    normalizeWhatsappTicketVisibility(ticketVisibility) ===
    WHATSAPP_TICKET_VISIBILITY_ALL
  );
}

export async function loadWhatsappTicketVisibility(
  whatsappId: number,
  companyId: number
): Promise<string> {
  const row = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: ["ticketVisibility"]
  });
  return normalizeWhatsappTicketVisibility(row?.ticketVisibility);
}

/** Exclui tickets de conexões admin_supervisor para utilizadores comuns. */
export function buildExcludeRestrictedWhatsappWhere(
  companyId: number
): Filterable["where"] {
  return literal(`(
    "Ticket"."whatsappId" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "Whatsapps" AS w
      WHERE w.id = "Ticket"."whatsappId"
        AND w."companyId" = ${Number(companyId)}
        AND w."ticketVisibility" = '${WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR}'
    )
  )`);
}

/** Tickets em conexões restritas (visíveis a admin/supervisor/support). */
export function buildRestrictedWhatsappTicketsWhere(
  companyId: number
): Filterable["where"] {
  return literal(`EXISTS (
    SELECT 1 FROM "Whatsapps" AS w
    WHERE w.id = "Ticket"."whatsappId"
      AND w."companyId" = ${Number(companyId)}
      AND w."ticketVisibility" = '${WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR}'
  )`);
}

/**
 * Lista de tickets para agente: regras de fila/allTicket + visibilidade por conexão.
 */
export function buildAgentTicketListWhere(
  actor: WhatsappTicketVisibilityActor,
  userPk: string | number,
  queueIds: number[],
  allowNullQueueTickets: boolean,
  companyId: number
): Filterable["where"] {
  const base = buildNonAdminTicketListWhere(
    userPk,
    queueIds,
    allowNullQueueTickets
  );

  if (!isWhatsappTicketVisibilityPrivileged(actor)) {
    return {
      [Op.and]: [base, buildExcludeRestrictedWhatsappWhere(companyId)]
    };
  }

  return {
    [Op.or]: [base, buildRestrictedWhatsappTicketsWhere(companyId)]
  };
}

/**
 * Modo showAll (admin): filas selecionadas + sem setor, respeitando visibilidade por conexão.
 */
export function buildShowAllTicketListWhere(
  actor: WhatsappTicketVisibilityActor,
  queueIds: number[],
  companyId: number
): Filterable["where"] {
  const base =
    Array.isArray(queueIds) && queueIds.length > 0
      ? queueInAllowedOrUnassigned(queueIds)
      : {};
  if (isWhatsappTicketVisibilityPrivileged(actor)) {
    return base;
  }
  return {
    [Op.and]: [base, buildExcludeRestrictedWhatsappWhere(companyId)]
  };
}

export async function filterUserIdsByWhatsappTicketVisibility(
  companyId: number,
  whatsappId: number | null | undefined,
  recipientIds: number[]
): Promise<number[]> {
  if (!whatsappId || !recipientIds.length) {
    return recipientIds;
  }

  const visibility = await loadWhatsappTicketVisibility(
    Number(whatsappId),
    companyId
  );
  if (visibility !== WHATSAPP_TICKET_VISIBILITY_ADMIN_SUPERVISOR) {
    return recipientIds;
  }

  const unique = [...new Set(recipientIds.filter(Number.isFinite))];
  if (!unique.length) return [];

  const users = await User.findAll({
    where: { id: { [Op.in]: unique }, companyId },
    attributes: ["id", "profile"]
  });

  return users
    .filter((u) =>
      isWhatsappTicketVisibilityPrivileged({
        id: u.id,
        profile: u.profile,
        supportMode: false
      })
    )
    .map((u) => Number(u.id));
}

export async function assertWhatsappTicketAccess(
  ticket: {
    whatsappId?: number | string | null;
    companyId?: number;
    whatsapp?: { ticketVisibility?: string | null } | null;
  },
  actor: WhatsappTicketVisibilityActor,
  companyId: number
): Promise<void> {
  let visibility = ticket.whatsapp?.ticketVisibility;
  if (visibility == null && ticket.whatsappId != null) {
    visibility = await loadWhatsappTicketVisibility(
      Number(ticket.whatsappId),
      companyId
    );
  } else {
    visibility = normalizeWhatsappTicketVisibility(visibility);
  }

  if (!canUserAccessTicketByWhatsapp(visibility, actor)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
}
