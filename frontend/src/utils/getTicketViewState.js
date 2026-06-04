import { isOrphanTicket } from "./isOrphanTicket";
import { isGroupTicket } from "./isGroupTicket";

/** Estados visuais únicos do painel de atendimento (mutuamente exclusivos). */
export const TICKET_VIEW_STATE = {
  LOADING: "loading",
  ACTIVE: "active",
  PENDING: "pending",
  CLOSED: "closed",
  ORPHAN: "orphan",
};

/**
 * Define um único ticketState para layout/banners/composer.
 * Órfão tem prioridade sobre pending (evita banners empilhados).
 */
export function getTicketViewState(ticket, { loading = false } = {}) {
  if (loading || !ticket?.id) {
    return TICKET_VIEW_STATE.LOADING;
  }

  if (isOrphanTicket(ticket)) {
    return TICKET_VIEW_STATE.ORPHAN;
  }

  if (isGroupTicket(ticket)) {
    const status = String(ticket.status || "").toLowerCase();
    if (status === "closed") {
      return TICKET_VIEW_STATE.CLOSED;
    }
    return TICKET_VIEW_STATE.ACTIVE;
  }

  const status = String(ticket.status || "").toLowerCase();
  if (status === "pending") {
    return TICKET_VIEW_STATE.PENDING;
  }
  if (status === "closed") {
    return TICKET_VIEW_STATE.CLOSED;
  }

  return TICKET_VIEW_STATE.ACTIVE;
}

export default getTicketViewState;
