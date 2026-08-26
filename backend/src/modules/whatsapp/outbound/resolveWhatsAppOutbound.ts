import { WASocket } from "@whiskeysockets/baileys";
import GetWhatsappWbot from "../../../helpers/GetWhatsappWbot";
import GetDefaultWhatsApp from "../../../helpers/GetDefaultWhatsApp";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import AppError from "../../../errors/AppError";
import { isInstagramChannelTicket } from "../../../helpers/ticketChannel";
import { WhatsAppOutbound } from "./WhatsAppOutbound";
import { BaileysWhatsAppOutbound } from "../providers/baileys/outbound/BaileysWhatsAppOutbound";
import {
  isBaileysConnection,
  isEvolutionConnection,
  resolveWhatsAppConnectionProvider
} from "../connectionProvider";
import {
  ERR_WHATSAPP_PROVIDER_NOT_READY,
  throwEvolutionProviderNotReady
} from "../providers/evolution/evolutionErrors";

type Session = WASocket & { id?: number };

/**
 * Resolução outbound por conexão WhatsApp (multi-provider).
 * Baileys → BaileysWhatsAppOutbound.
 * Evolution → erro controlado (Fase 5: transporte ainda não pronto).
 * Nunca resolve Evolution via GetTicketWbot/GetWhatsappWbot.
 */
export async function getWhatsAppOutboundForWhatsapp(
  whatsapp: Whatsapp
): Promise<WhatsAppOutbound> {
  const provider = resolveWhatsAppConnectionProvider(whatsapp);

  if (isEvolutionConnection(provider)) {
    throwEvolutionProviderNotReady(
      `Conexão ${whatsapp.id} é Evolution; outbound ainda não está pronto (${ERR_WHATSAPP_PROVIDER_NOT_READY}).`
    );
  }

  if (!isBaileysConnection(provider)) {
    throwEvolutionProviderNotReady(
      `Provider de transporte não suportado para outbound: ${provider}`
    );
  }

  const wbot = await GetWhatsappWbot(whatsapp);
  return new BaileysWhatsAppOutbound(wbot);
}

export async function getWhatsAppOutboundForTicket(
  ticket: Ticket
): Promise<WhatsAppOutbound> {
  if (isInstagramChannelTicket(ticket)) {
    throw new AppError(
      "ERR_TICKET_CHANNEL_NOT_WHATSAPP",
      400,
      "Este atendimento não utiliza conexão WhatsApp."
    );
  }

  let whatsapp: Whatsapp | null = null;

  if (ticket.whatsappId) {
    whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  } else {
    whatsapp = await GetDefaultWhatsApp(ticket.companyId, ticket.user?.id);
    await ticket.update({ whatsappId: whatsapp.id });
  }

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  return getWhatsAppOutboundForWhatsapp(whatsapp);
}

/**
 * Quando o socket já veio do listener inbound (Typebot), encapsula sem
 * resolver a sessão de novo. Exclusivo Baileys.
 */
export function wrapBaileysSession(wbot: Session): WhatsAppOutbound {
  return new BaileysWhatsAppOutbound(wbot);
}
