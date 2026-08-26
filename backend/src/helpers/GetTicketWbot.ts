import { WASocket } from "@whiskeysockets/baileys";
import { getWbot } from "../libs/wbot";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";
import { Store } from "../libs/store";
import AppError from "../errors/AppError";
import { isInstagramChannelTicket } from "./ticketChannel";
import Whatsapp from "../models/Whatsapp";
import {
  isEvolutionConnection,
  resolveWhatsAppConnectionProvider
} from "../modules/whatsapp/connectionProvider";
import { ERR_WHATSAPP_PROVIDER_NOT_BAILEYS } from "../modules/whatsapp/providers/evolution/evolutionErrors";

type Session = WASocket & {
  id?: number;
  store?: Store;
};

/**
 * Helper Baileys-specific: retorna WASocket em memória.
 * Não usar para conexões Evolution — preferir resolveWhatsAppOutbound.
 */
const GetTicketWbot = async (ticket: Ticket): Promise<Session> => {
  if (isInstagramChannelTicket(ticket)) {
    throw new AppError(
      "ERR_TICKET_CHANNEL_NOT_WHATSAPP",
      400,
      "Este atendimento não utiliza conexão WhatsApp."
    );
  }

  if (!ticket.whatsappId) {
    const defaultWhatsapp = await GetDefaultWhatsApp(
      ticket.companyId,
      ticket.user?.id
    );
    await ticket.update({ whatsappId: defaultWhatsapp.id });
  }

  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  if (
    whatsapp &&
    isEvolutionConnection(resolveWhatsAppConnectionProvider(whatsapp))
  ) {
    throw new AppError(
      ERR_WHATSAPP_PROVIDER_NOT_BAILEYS,
      400,
      "GetTicketWbot é exclusivo Baileys. Use o resolver multi-provider."
    );
  }

  const wbot = getWbot(ticket.whatsappId);
  return wbot;
};

export default GetTicketWbot;
