import { WASocket } from "@whiskeysockets/baileys";
import { getWbot } from "../libs/wbot";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";
import { Store } from "../libs/store";
import AppError from "../errors/AppError";
import { isInstagramChannelTicket } from "./ticketChannel";

type Session = WASocket & {
  id?: number;
  store?: Store;
};

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

  const wbot = getWbot(ticket.whatsappId);
  return wbot;
};

export default GetTicketWbot;
