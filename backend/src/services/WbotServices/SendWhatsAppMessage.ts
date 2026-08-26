import { WAMessage, jidNormalizedUser } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import { getTicketRemoteJid } from "../../helpers/GetTicketRemoteJid";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { getWhatsAppOutboundForTicket } from "../../modules/whatsapp/outbound/resolveWhatsAppOutbound";

import formatBody from "../../helpers/Mustache";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  /** JID da conversa original (ex: @lid). Use quando disponível para garantir que a resposta chegue no mesmo chat do cliente. */
  remoteJid?: string;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  remoteJid: remoteJidOverride
}: Request): Promise<WAMessage> => {
  const outbound = await getWhatsAppOutboundForTicket(ticket);
  // Evitar enviar para o próprio número da conexão (resposta indo para "si mesmo")
  const ownJid = outbound.getOwnUserJid();
  if (
    !ticket.isGroup &&
    ticket.contact?.number &&
    ticket.contact.number !== "LID" &&
    ownJid
  ) {
    const destNumber = String(ticket.contact.number).replace(/\D/g, "");
    const myNumber = jidNormalizedUser(ownJid).replace(/\D/g, "");
    if (destNumber && myNumber && destNumber === myNumber) {
      throw new AppError(
        "Não é possível enviar mensagem para o próprio número da conexão. Verifique o contato do ticket."
      );
    }
  }
  // Obter JID para envio: override > ticket (dataWebhook ou última mensagem) > construir do contato
  let number = remoteJidOverride || (await getTicketRemoteJid(ticket));
  if (!number) {
    const destNumber = String(ticket.contact?.number || "").replace(/\D/g, "");
    if (!destNumber && !ticket.isGroup) {
      throw new AppError(
        "Não foi possível obter o destino da mensagem. O contato pode ter número oculto (LID) e não há histórico de conversa."
      );
    }
    number = ticket.isGroup
      ? `${destNumber}@g.us`
      : `${destNumber}@s.whatsapp.net`;
  }

  let quoted: {
    dataJson?: string | Record<string, unknown> | null;
    destinationJid: string;
    isGroup: boolean;
    stanzaId?: string;
    fromMe?: boolean;
    participant?: string | null;
    body?: string | null;
  } | null = null;

  if (quotedMsg) {
    const chatMessages = await Message.findOne({
      where: {
        id: quotedMsg.id
      }
    });

    if (chatMessages) {
      quoted = {
        dataJson: chatMessages.dataJson,
        destinationJid: number,
        isGroup: Boolean(ticket.isGroup),
        stanzaId: chatMessages.id,
        fromMe: Boolean(chatMessages.fromMe),
        participant: chatMessages.participant || null,
        body: chatMessages.body || null
      };
    }
  }

  try {
    const chatJid = number.includes("@") ? jidNormalizedUser(number) : number;
    const textPayload = formatBody(body, ticket.contact);
    const sendStartedAt = Date.now();
    logger.info(
      {
        ticketId: ticket.id,
        companyId: ticket.companyId,
        whatsappId: ticket.whatsappId,
        chatJid,
        hasQuotedMsg: Boolean(quotedMsg)
      },
      "[SendPerf] baileys_send_start"
    );
    const sent = await outbound.sendText({
      jid: chatJid,
      text: textPayload,
      quoted
    });
    logger.info(
      {
        ticketId: ticket.id,
        companyId: ticket.companyId,
        whatsappId: ticket.whatsappId,
        chatJid,
        baileysMessageId: sent.messageId,
        durationMs: Date.now() - sendStartedAt
      },
      "[SendPerf] baileys_send_done"
    );

    await ticket.update({ lastMessage: formatBody(body, ticket.contact) });
    return sent.rawSentMessage as WAMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
