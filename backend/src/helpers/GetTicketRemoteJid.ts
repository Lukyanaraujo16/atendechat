import Message from "../models/Message";
import Ticket from "../models/Ticket";

/**
 * Obtém o JID correto para enviar mensagens ao cliente.
 * Resolve conversas LID usando remoteJid salvo no ticket ou na última mensagem.
 */
export const getTicketRemoteJid = async (ticket: Ticket): Promise<string | null> => {
  const ticketData = ticket.dataWebhook as { remoteJid?: string } | null | undefined;
  if (ticketData?.remoteJid && ticketData.remoteJid.includes("@")) {
    return ticketData.remoteJid;
  }
  if (!ticket.isGroup && (!ticket.contact?.number || ticket.contact.number === "LID")) {
    const lastMsg = await Message.findOne({
      where: { ticketId: ticket.id },
      order: [["createdAt", "DESC"]],
      attributes: ["remoteJid"]
    });
    if (lastMsg?.remoteJid && lastMsg.remoteJid.includes("@")) {
      return lastMsg.remoteJid;
    }
  }
  return null;
};
