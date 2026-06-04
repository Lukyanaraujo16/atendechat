import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import { isGroupVisibilityPrivileged, GroupAccessActor } from "./groupVisibility";

export function isGroupTicket(
  ticket: {
    isGroup?: boolean;
    contact?: { isGroup?: boolean } | null;
  } | null | undefined
): boolean {
  if (!ticket) return false;
  return ticket.isGroup === true || ticket.contact?.isGroup === true;
}

/**
 * Grupos são conversas permanentes na aba Grupos: sempre open, sem responsável/fila.
 */
export async function ensureGroupTicketPermanentOpen(
  ticket: Ticket
): Promise<Ticket> {
  if (!isGroupTicket(ticket)) return ticket;

  const needsUpdate =
    ticket.status !== "open" ||
    ticket.userId != null ||
    (ticket.queueId != null && ticket.queueId !== undefined);

  if (!needsUpdate) return ticket;

  await ticket.update({
    status: "open",
    userId: null,
    queueId: null
  });

  ticket.status = "open";
  ticket.userId = null as any;
  ticket.queueId = null as any;

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
