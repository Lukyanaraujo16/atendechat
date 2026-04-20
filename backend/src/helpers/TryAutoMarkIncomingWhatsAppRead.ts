import { proto, WASocket } from "@whiskeysockets/baileys";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

type Session = WASocket & { id?: number };

/**
 * Envia confirmação de leitura ao WhatsApp para uma mensagem recebida já persistida.
 * Usa a sessão da conexão do ticket; falhas são ignoradas (ex.: sessão desligada).
 */
const tryAutoMarkIncomingWhatsAppRead = async (params: {
  msg: proto.IWebMessageInfo;
  ticket: Ticket;
  wbot?: Session | null;
  /** false = desligado na conexão; true/omitido com consulta ao registo quando omitido em wbot-only flows */
  autoReadMessages?: boolean;
}): Promise<void> => {
  const { msg, ticket, wbot: wbotArg } = params;
  if (msg.key?.fromMe) return;
  if (!msg.key?.id) return;
  if (!ticket?.whatsappId) return;

  let allow = params.autoReadMessages;
  if (allow === undefined) {
    const row = await Whatsapp.findByPk(ticket.whatsappId, {
      attributes: ["autoReadMessages"]
    });
    allow = row ? row.autoReadMessages !== false : true;
  }
  if (allow === false) return;

  try {
    const wbot = (wbotArg ?? (await GetTicketWbot(ticket))) as Session | null;
    if (!wbot || typeof (wbot as WASocket).readMessages !== "function") {
      return;
    }
    await (wbot as WASocket).readMessages([msg.key]);
  } catch (err) {
    logger.warn(
      {
        err,
        ticketId: ticket.id,
        whatsappId: ticket.whatsappId,
        msgId: msg.key.id
      },
      "Could not auto-mark WhatsApp message as read (session offline or transient error)"
    );
  }
};

export default tryAutoMarkIncomingWhatsAppRead;
