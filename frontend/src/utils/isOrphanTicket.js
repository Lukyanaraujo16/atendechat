/** Mesmo critério de `WHATSAPP_CONNECTED_STATUS` em backend/src/helpers/ticketOrphan.ts */
export const WHATSAPP_CONNECTED_STATUS = "CONNECTED";

/**
 * Ticket sem conexão WhatsApp utilizável (órfão).
 * Independente de status do ticket (pending/open/closed).
 * Retorna false sem `ticket.id` (estado inicial `{}` ou loading).
 * Prioriza `isOrphan` do backend; fallback alinhado a ticketNeedsWhatsappReassign.
 */
export function isOrphanTicket(ticket) {
  if (!ticket || ticket.id == null || ticket.id === undefined) {
    return false;
  }

  if (ticket.isOrphan === true) {
    return true;
  }

  if (ticket.isOrphan === false) {
    return false;
  }

  const whatsappId = ticket.whatsappId;
  if (whatsappId == null || whatsappId === undefined) {
    return true;
  }

  const whatsapp = ticket.whatsapp;
  if (!whatsapp) {
    return true;
  }

  const status = String(whatsapp.status || "")
    .trim()
    .toUpperCase();
  return status !== WHATSAPP_CONNECTED_STATUS;
}

export default isOrphanTicket;
