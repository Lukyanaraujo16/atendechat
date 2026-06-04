import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import {
  isGroupVisibilityPrivileged,
  GroupAccessActor
} from "./groupVisibility";

/** Sequelize/JSON podem devolver boolean ou 0/1. */
export function isTruthyGroupFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function isGroupTicket(
  ticket: {
    isGroup?: boolean | number | string | null;
    contact?: { isGroup?: boolean | number | string | null } | null;
  } | null | undefined
): boolean {
  if (!ticket) return false;
  return (
    isTruthyGroupFlag(ticket.isGroup) || isTruthyGroupFlag(ticket.contact?.isGroup)
  );
}

/**
 * Grupos são conversas permanentes na aba Grupos: sempre open, sem responsável/fila.
 */
export async function ensureGroupTicketPermanentOpen(
  ticket: Ticket
): Promise<Ticket> {
  if (!isGroupTicket(ticket)) return ticket;

  (ticket as any).isGroup = true;
  if ((ticket as any).dataValues) {
    (ticket as any).dataValues.isGroup = true;
  }

  const needsUpdate =
    ticket.status !== "open" ||
    ticket.userId != null ||
    (ticket.queueId != null && ticket.queueId !== undefined);

  if (!needsUpdate) return ticket;

  await ticket.update({
    status: "open",
    userId: null,
    queueId: null,
    isGroup: true
  });

  ticket.status = "open";
  ticket.userId = null as any;
  ticket.queueId = null as any;
  (ticket as any).isGroup = true;

  return ticket;
}

export type GroupTicketUpdateInput = {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  chatbot?: boolean;
  queueOptionId?: number;
  whatsappId?: string;
  useIntegration?: boolean;
  integrationId?: number | null;
  promptId?: number | null;
};

/**
 * Bloqueia aceitar/finalizar/transferir workflow de ticket 1:1 em conversas de grupo.
 */
export function normalizeGroupTicketUpdate(
  ticket: Ticket,
  ticketData: GroupTicketUpdateInput,
  actor: GroupAccessActor
): GroupTicketUpdateInput {
  if (!isGroupTicket(ticket)) return ticketData;

  if (ticketData.status === "closed") {
    throw new AppError(
      "ERR_GROUP_PERMANENT_CONVERSATION",
      403,
      "Conversas de grupo não podem ser finalizadas."
    );
  }

  const privileged = isGroupVisibilityPrivileged(actor);

  const next: GroupTicketUpdateInput = { ...ticketData };

  if (next.status !== undefined && next.status !== "open") {
    if (!privileged) {
      throw new AppError(
        "ERR_GROUP_PERMANENT_CONVERSATION",
        403,
        "Conversas de grupo permanecem abertas para o setor autorizado."
      );
    }
  }

  if (!privileged) {
    next.status = "open";
    next.userId = null;
    next.queueId = null;
  }

  return next;
}
