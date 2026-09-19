import formatBody from "../../helpers/Mustache";
import { getTicketRemoteJid } from "../../helpers/GetTicketRemoteJid";
import Ticket from "../../models/Ticket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { getWhatsAppOutboundForTicket } from "../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import type { NormalizedWhatsAppMessage } from "../../modules/whatsapp/inbound/NormalizedWhatsAppMessage";

export type SendQueueRoutingText = (
  ticket: Ticket,
  text: string,
  inbound: NormalizedWhatsAppMessage
) => Promise<void>;

export const sendQueueRoutingText: SendQueueRoutingText = async (
  ticket,
  text,
  inbound
) => {
  const outbound = await getWhatsAppOutboundForTicket(ticket);
  const jid =
    inbound.addressing?.remoteJid || (await getTicketRemoteJid(ticket));
  if (!jid) {
    throw new Error("queue routing: missing destination jid");
  }
  const formatted = formatBody(text, ticket.contact);
  const sent = await outbound.sendText({ jid, text: formatted });
  await ticket.update({ lastMessage: formatted });
  const messageId =
    sent.messageId && String(sent.messageId).length > 0
      ? String(sent.messageId)
      : `queue-routing-${ticket.id}-${Date.now()}`;
  await CreateMessageService({
    messageData: {
      id: messageId,
      ticketId: ticket.id,
      body: formatted,
      fromMe: true,
      read: true,
      mediaType: "conversation",
      ack: sent.status != null ? sent.status : 1
    },
    companyId: ticket.companyId
  });
};
