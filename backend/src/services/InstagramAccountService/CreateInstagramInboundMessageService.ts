import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import InstagramAccount from "../../models/InstagramAccount";
import notifyTicketInboundMessage from "../OneSignalPush/notifyTicketInboundMessage";
import { serializeMessageForClient } from "../MessageServices/CreateMessageService";

export interface InstagramInboundMessageData {
  id: string;
  ticketId: number;
  contactId: number;
  body: string;
  externalMessageId: string;
  mediaType?: string;
  mediaUrl?: string | null;
  metaPayload?: Record<string, unknown> | null;
  quotedMsgId?: string | null;
  queueId?: number | null;
}

interface Request {
  messageData: InstagramInboundMessageData;
  companyId: number;
}

const CreateInstagramInboundMessageService = async ({
  messageData,
  companyId
}: Request): Promise<Message> => {
  await Message.upsert({
    id: messageData.id,
    ticketId: messageData.ticketId,
    contactId: messageData.contactId,
    body: messageData.body,
    fromMe: false,
    read: false,
    mediaType: messageData.mediaType || "chat",
    mediaUrl: messageData.mediaUrl ?? null,
    ack: 0,
    channel: "instagram",
    externalMessageId: messageData.externalMessageId,
    metaPayload: messageData.metaPayload ?? null,
    quotedMsgId: messageData.quotedMsgId ?? null,
    remoteJid: null,
    dataJson: messageData.metaPayload
      ? JSON.stringify(messageData.metaPayload)
      : null,
    queueId: messageData.queueId ?? null,
    companyId
  });

  const message = await Message.findByPk(messageData.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          {
            model: InstagramAccount,
            as: "instagramAccount",
            attributes: ["id", "name", "status", "instagramBusinessAccountId"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_INSTAGRAM_MESSAGE");
  }

  if (message.ticket.queueId !== null && message.queueId === null) {
    await message.update({ queueId: message.ticket.queueId });
  }

  const io = getIO();
  const outboundMessage = serializeMessageForClient(message);
  const queueId = message.ticket.queueId;

  let emitTarget = io
    .to(message.ticketId.toString())
    .to(`company-${companyId}-${message.ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`company-${companyId}-mainchannel`);

  if (queueId != null) {
    emitTarget = emitTarget
      .to(`queue-${queueId}-${message.ticket.status}`)
      .to(`queue-${queueId}-notification`);
  }

  emitTarget.emit(`company-${companyId}-appMessage`, {
    action: "create",
    message: outboundMessage,
    ticket: message.ticket,
    contact: message.ticket.contact
  });

  void notifyTicketInboundMessage({ message, companyId });

  return message;
};

export default CreateInstagramInboundMessageService;
