const WHATSAPP_CONNECTED = "CONNECTED";

/**
 * Ticket sem conexão WhatsApp utilizável (órfão).
 * Prioriza `isOrphan` do backend; fallback local para payloads antigos.
 */
export function isOrphanTicket(ticket) {
  if (!ticket || ticket.id == null) {
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
  return status !== WHATSAPP_CONNECTED;
}

export default isOrphanTicket;
