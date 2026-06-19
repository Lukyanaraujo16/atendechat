import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import { parseTicketDataWebhook } from "./GetTicketRemoteJid";

export const WHATSAPP_CONNECTED_STATUS = "CONNECTED";

/** Ticket precisa de nova conexão: sem ID, registro ausente ou WhatsApp não conectado. */
export function ticketNeedsWhatsappReassign(
  ticket: { whatsappId?: number | null },
  linkedWhatsapp: Whatsapp | null
): boolean {
  if (ticket.whatsappId == null || ticket.whatsappId === undefined) {
    return true;
  }
  if (!linkedWhatsapp) {
    return true;
  }
  const st = String(linkedWhatsapp.status || "").trim().toUpperCase();
  return st !== WHATSAPP_CONNECTED_STATUS;
}

/** `dataWebhook.startedOutsideSystem`: primeira mensagem foi enviada pelo WhatsApp (celular), fora do painel. */
export function setStartedOutsideSystemOnTicket(ticket: Ticket): void {
  const dw = parseTicketDataWebhook(ticket.dataWebhook);
  const v = dw.startedOutsideSystem;
  (ticket as any).dataValues.startedOutsideSystem =
    v === true || v === "true";
}

/**
 * Conexão inválida/ausente ou fora de CONNECTED — UI e reassign devem tratar como órfão operacional.
 * Requer `whatsapp` com LEFT JOIN (`required: false`) para refletir registro apagado.
 */
export function setIsOrphanOnTicket(ticket: Ticket): void {
  if (String(ticket.channel || "").toLowerCase() === "instagram") {
    (ticket as any).dataValues.isOrphan = false;
    return;
  }

  const linked =
    ticket.whatsapp === null || ticket.whatsapp === undefined
      ? null
      : ticket.whatsapp;
  const isOrphan = ticketNeedsWhatsappReassign(ticket, linked);
  (ticket as any).dataValues.isOrphan = isOrphan;
}

export function attachTicketIsOrphanFlag(tickets: Ticket[]): void {
  for (const t of tickets) {
    setIsOrphanOnTicket(t);
    setStartedOutsideSystemOnTicket(t);
  }
}
