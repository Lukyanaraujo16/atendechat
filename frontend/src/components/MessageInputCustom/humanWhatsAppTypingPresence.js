import api from "../../services/api";

export const HUMAN_WHATSAPP_TYPING = {
  composingThrottleMs: 3500,
  idlePauseMs: 2500,
};

export function isEligibleForHumanWhatsAppTypingPresence({
  ticketId,
  ticket,
  ticketStatus,
  enabled = true,
}) {
  if (!enabled) return false;
  if (ticketId == null || ticketId === "") return false;
  if (ticketStatus !== "open") return false;
  if (!ticket || ticket.id == null) return false;
  const channel = String(ticket.channel || "whatsapp").toLowerCase();
  if (channel === "instagram") return false;
  if (channel !== "whatsapp") return false;
  if (ticket.isGroup === true || ticket.contact?.isGroup === true) {
    return false;
  }
  if (ticket.isOrphan === true) return false;
  if (ticket.whatsappId == null || ticket.whatsappId === undefined) {
    return false;
  }
  return true;
}

export function sendHumanTicketPresence(ticketId, presence) {
  if (ticketId == null || ticketId === "") {
    return Promise.resolve(null);
  }
  if (presence !== "composing" && presence !== "paused") {
    return Promise.resolve(null);
  }
  return api
    .post(`/tickets/${ticketId}/presence`, { presence })
    .catch(() => null);
}
