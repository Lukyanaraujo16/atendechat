import AppError from "../../errors/AppError";
import { getWhatsAppOutboundForTicket } from "../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

/**
 * Apaga mensagem no provider via WhatsAppOutbound.
 * Usa colunas semânticas Message (id/remoteJid/participant/fromMe) —
 * sem GetTicketWbot / WAMessage (Evolution-safe).
 */
const DeleteWhatsAppMessage = async (messageId: string): Promise<Message> => {
  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  const { ticket } = message;
  const remoteJid = String(message.remoteJid || "").trim();
  if (!remoteJid) {
    throw new AppError("ERR_DELETE_WAPP_MSG");
  }

  try {
    const outbound = await getWhatsAppOutboundForTicket(ticket);
    await outbound.deleteMessage({
      jid: remoteJid,
      target: {
        id: message.id,
        remoteJid,
        participant: message.participant,
        fromMe: Boolean(message.fromMe)
      }
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("ERR_DELETE_WAPP_MSG");
  }
  await message.update({ isDeleted: true });

  return message;
};

export default DeleteWhatsAppMessage;
