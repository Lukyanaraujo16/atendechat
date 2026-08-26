import AppError from "../../errors/AppError";
import GetWbotMessage from "../../helpers/GetWbotMessage";
import { getWhatsAppOutboundForTicket } from "../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

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

  const messageToDelete = await GetWbotMessage(ticket, messageId);

  try {
    const outbound = await getWhatsAppOutboundForTicket(ticket);
    const menssageDelete = messageToDelete as Message;

    await outbound.deleteMessage({
      jid: menssageDelete.remoteJid,
      target: {
        id: menssageDelete.id,
        remoteJid: menssageDelete.remoteJid,
        participant: menssageDelete.participant,
        fromMe: menssageDelete.fromMe
      }
    });
  } catch (err) {
    throw new AppError("ERR_DELETE_WAPP_MSG");
  }
  await message.update({ isDeleted: true });

  return message;
};

export default DeleteWhatsAppMessage;
