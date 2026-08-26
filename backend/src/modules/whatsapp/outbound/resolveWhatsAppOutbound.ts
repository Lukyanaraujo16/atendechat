import { WASocket } from "@whiskeysockets/baileys";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import GetWhatsappWbot from "../../../helpers/GetWhatsappWbot";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import { WhatsAppOutbound } from "./WhatsAppOutbound";
import { BaileysWhatsAppOutbound } from "../providers/baileys/outbound/BaileysWhatsAppOutbound";

type Session = WASocket & { id?: number };

/**
 * Resolução outbound por conexão WhatsApp.
 * Fase 2: sempre Baileys. Sem connectionProvider / switch Evolution.
 */
export async function getWhatsAppOutboundForTicket(
  ticket: Ticket
): Promise<WhatsAppOutbound> {
  const wbot = await GetTicketWbot(ticket);
  return new BaileysWhatsAppOutbound(wbot);
}

export async function getWhatsAppOutboundForWhatsapp(
  whatsapp: Whatsapp
): Promise<WhatsAppOutbound> {
  const wbot = await GetWhatsappWbot(whatsapp);
  return new BaileysWhatsAppOutbound(wbot);
}

/**
 * Quando o socket já veio do listener inbound (Typebot), encapsula sem
 * resolver a sessão de novo.
 */
export function wrapBaileysSession(wbot: Session): WhatsAppOutbound {
  return new BaileysWhatsAppOutbound(wbot);
}
