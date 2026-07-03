import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import notifyTicketInboundMessage from "../OneSignalPush/notifyTicketInboundMessage";
import { enrichSingleGroupMessage } from "../../helpers/enrichGroupMessagesDisplay";
import { logger } from "../../utils/logger";

export interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  queueId?: number;
}
interface Request {
  messageData: MessageData;
  companyId: number;
}

const CreateMessageService = async ({
  messageData,
  companyId
}: Request): Promise<Message> => {
  const sendPerfStartedAt = Date.now();
  const sendPerfLog = (
    event: string,
    extra: Record<string, unknown> = {}
  ): void => {
    logger.info(
      {
        ticketId: messageData.ticketId,
        companyId,
        messageId: messageData.id,
        durationMs: Date.now() - sendPerfStartedAt,
        ...extra
      },
      `[SendPerf] ${event}`
    );
  };

  sendPerfLog("db_upsert_start");
  await Message.upsert({ ...messageData, companyId });
  sendPerfLog("db_upsert_done");

  sendPerfLog("db_find_message_start");
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
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name", "ticketVisibility"]
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
  sendPerfLog("db_find_message_done");

  if (message.ticket.queueId !== null && message.queueId === null) {
    sendPerfLog("db_queue_update_start", {
      queueId: message.ticket.queueId
    });
    await message.update({ queueId: message.ticket.queueId });
    sendPerfLog("db_queue_update_done", {
      queueId: message.ticket.queueId
    });
  }

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  const io = getIO();
  const outboundMessage = serializeMessageForClient(message);

  // mainchannel: todos os usuários da empresa já estão na sala (libs/socket.ts).
  // Sem isso, tickets com queueId null ou fora das filas do usuário não recebiam o evento em tempo real.
  sendPerfLog("socket_emit_start", {
    queueId: message.ticket.queueId,
    status: message.ticket.status
  });
  io.to(message.ticketId.toString())
    .to(`company-${companyId}-${message.ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`company-${companyId}-mainchannel`)
    .to(`queue-${message.ticket.queueId}-${message.ticket.status}`)
    .to(`queue-${message.ticket.queueId}-notification`)
    .emit(`company-${companyId}-appMessage`, {
      action: "create",
      message: outboundMessage,
      ticket: message.ticket,
      contact: message.ticket.contact
    });
  sendPerfLog("socket_emit_done", {
    queueId: message.ticket.queueId,
    status: message.ticket.status
  });

  if (message.fromMe !== true) {
    void notifyTicketInboundMessage({ message, companyId });
  }

  return message;
};

/** Payload JSON estável para socket e resposta HTTP (garante ticketId no topo). */
export function serializeMessageForClient(message: Message) {
  const plain =
    message.ticket?.isGroup === true
      ? enrichSingleGroupMessage(message)
      : (message.get({ plain: true }) as Record<string, unknown>);

  const ticketId =
    plain.ticketId ??
    (plain.ticket as { id?: number } | undefined)?.id ??
    message.ticketId;

  return {
    ...plain,
    ticketId
  };
}

export default CreateMessageService;
