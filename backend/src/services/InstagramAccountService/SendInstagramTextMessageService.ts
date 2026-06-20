import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import InstagramAccount from "../../models/InstagramAccount";
import { getIO } from "../../libs/socket";
import { isInstagramChannelTicket } from "../../helpers/ticketChannel";
import { logger } from "../../utils/logger";
import { serializeMessageForClient } from "../MessageServices/CreateMessageService";
import resolveInstagramAccountToken from "./resolveInstagramAccountToken";
import {
  mapInstagramOutboundSendError,
  sendInstagramDirectTextMessage
} from "./MetaGraphApiService";

interface Request {
  ticket: Ticket;
  body: string;
  companyId: number;
  quotedMsg?: Message | null;
}

const SendInstagramTextMessageService = async ({
  ticket,
  body,
  companyId,
  quotedMsg
}: Request): Promise<Message> => {
  if (!isInstagramChannelTicket(ticket)) {
    throw new AppError("ERR_TICKET_CHANNEL_NOT_INSTAGRAM", 400);
  }

  const text = body?.trim();
  if (!text) {
    throw new AppError("ERR_MESSAGE_BODY_REQUIRED", 400);
  }

  if (ticket.status !== "open") {
    throw new AppError(
      "ERR_TICKET_NOT_OPEN",
      400,
      "Aceite o atendimento antes de responder."
    );
  }

  const instagramAccountId = ticket.instagramAccountId;
  if (!instagramAccountId) {
    throw new AppError("ERR_INSTAGRAM_ACCOUNT_MISSING", 400);
  }

  let contact = ticket.contact;
  if (!contact?.instagramScopedId && ticket.contactId) {
    contact = await Contact.findByPk(ticket.contactId);
  }

  const recipientId = contact?.instagramScopedId;
  if (!recipientId) {
    throw new AppError("ERR_INSTAGRAM_RECIPIENT_MISSING", 400);
  }

  const { account, accessToken } = await resolveInstagramAccountToken(
    instagramAccountId,
    companyId
  );

  if (account.status !== "CONNECTED") {
    throw new AppError(
      "ERR_INSTAGRAM_ACCOUNT_NOT_CONNECTED",
      400,
      "Conta Instagram desconectada. Reconecte o token antes de responder."
    );
  }

  const businessId = account.instagramBusinessAccountId;
  if (!businessId) {
    throw new AppError("ERR_INSTAGRAM_BUSINESS_ID_MISSING", 400);
  }

  logger.info(
    {
      ticketId: ticket.id,
      companyId,
      instagramAccountId: account.id,
      recipientId
    },
    "[InstagramOutbound] sending"
  );

  const replyToMid =
    quotedMsg?.externalMessageId ||
    (quotedMsg?.id && quotedMsg.id !== quotedMsg?.externalMessageId
      ? quotedMsg.id
      : null);

  if (quotedMsg?.id) {
    logger.info(
      {
        ticketId: ticket.id,
        quotedMsgId: quotedMsg.id,
        replyToMid
      },
      "[InstagramReply] detected"
    );
  }

  try {
    const sendResult = await sendInstagramDirectTextMessage(
      businessId,
      recipientId,
      text,
      accessToken,
      replyToMid
    );

    logger.info(
      {
        ticketId: ticket.id,
        externalMessageId: sendResult.messageId
      },
      "[InstagramOutbound] sent"
    );

    const messageId = sendResult.messageId || uuidv4();

    await ticket.update({ lastMessage: text });

    await Message.upsert({
      id: messageId,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: text,
      fromMe: true,
      read: true,
      mediaType: "chat",
      ack: 2,
      channel: "instagram",
      externalMessageId: sendResult.messageId,
      metaPayload: sendResult.rawResponse,
      quotedMsgId: quotedMsg?.id ?? null,
      remoteJid: null,
      dataJson: JSON.stringify(sendResult.rawResponse),
      queueId: ticket.queueId ?? null,
      companyId
    });

    if (quotedMsg?.id) {
      logger.info(
        {
          ticketId: ticket.id,
          quotedMsgId: quotedMsg.id,
          replyToMid,
          externalMessageId: sendResult.messageId
        },
        "[InstagramReply] linked"
      );
    }

    const message = await Message.findByPk(messageId, {
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
      throw new AppError("ERR_CREATING_INSTAGRAM_MESSAGE", 500);
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

    return message;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    const mapped = mapInstagramOutboundSendError(err);
    logger.warn(
      {
        ticketId: ticket.id,
        statusCode: mapped.statusCode,
        metaErrorCode: mapped.metaCode,
        metaErrorMessage: mapped.metaMessage
      },
      "[InstagramOutbound] failed"
    );
    throw mapped.appError;
  }
};

export default SendInstagramTextMessageService;
