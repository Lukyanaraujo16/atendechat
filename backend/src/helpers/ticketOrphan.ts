import Ticket from "../models/Ticket";
import { parseTicketDataWebhook } from "./GetTicketRemoteJid";

/** `dataWebhook.startedOutsideSystem`: primeira mensagem foi enviada pelo WhatsApp (celular), fora do painel. */
export function setStartedOutsideSystemOnTicket(ticket: Ticket): void {
  const dw = parseTicketDataWebhook(ticket.dataWebhook);
  const v = dw.startedOutsideSystem;
  (ticket as any).dataValues.startedOutsideSystem =
    v === true || v === "true";
}

/** Conexão removida ou ticket sem `whatsappId`: ações administrativas devem seguir válidas. */
export function setIsOrphanOnTicket(ticket: Ticket): void {
  const isOrphan =
    ticket.whatsappId == null ||
    ticket.whatsapp === null ||
    ticket.whatsapp === undefined;
  (ticket as any).dataValues.isOrphan = isOrphan;
}

export function attachTicketIsOrphanFlag(tickets: Ticket[]): void {
  for (const t of tickets) {
    setIsOrphanOnTicket(t);
    setStartedOutsideSystemOnTicket(t);
  }
}
