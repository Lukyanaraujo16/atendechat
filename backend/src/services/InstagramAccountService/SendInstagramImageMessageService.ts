import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import InstagramAccount from "../../models/InstagramAccount";
import { getIO } from "../../libs/socket";
import formatBody from "../../helpers/Mustache";
import {
  assertInstagramImageUpload,
  buildInstagramPublicMediaUrl,
  moveUploadedFileToInstagramFolder
} from "../../helpers/instagramMediaStorage";
import { isInstagramChannelTicket } from "../../helpers/ticketChannel";
import { logger } from "../../utils/logger";
import { incrementCompanyStorageUsage } from "../CompanyService/adjustCompanyStorageUsage";
import { serializeMessageForClient } from "../MessageServices/CreateMessageService";
import resolveInstagramAccountToken from "./resolveInstagramAccountToken";
import {
  mapInstagramOutboundSendError,
  sendInstagramDirectImageMessage
} from "./MetaGraphApiService";

interface Request {
  ticket: Ticket;
  media: Express.Multer.File;
  body?: string;
  companyId: number;
}

const SendInstagramImageMessageService = async ({
  ticket,
  media,
  body,
  companyId
}: Request): Promise<Message> => {
  if (!isInstagramChannelTicket(ticket)) {
    throw new AppError("ERR_TICKET_CHANNEL_NOT_INSTAGRAM", 400);
  }

  if (ticket.status !== "open") {
    throw new AppError(
      "ERR_TICKET_NOT_OPEN",
      400,
      "Aceite o atendimento antes de responder."
    );
  }

  try {
    assertInstagramImageUpload(media);
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (code === "ERR_INSTAGRAM_IMAGE_TOO_LARGE") {
      throw new AppError(
        "ERR_INSTAGRAM_IMAGE_TOO_LARGE",
        400,
        "Imagem muito grande para envio pelo Instagram."
      );
    }
    throw new AppError(
      "ERR_INSTAGRAM_MEDIA_TYPE_UNSUPPORTED",
      400,
      "Este tipo de mídia ainda não é suportado no Instagram."
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
      recipientId,
      originalName: media.originalname,
      mimeType: media.mimetype,
      bytes: media.size
    },
    "[InstagramMediaOutbound] uploading/saving"
  );

  const savedFile = moveUploadedFileToInstagramFolder({
    companyId,
    sourcePath: media.path,
    originalName: media.originalname,
    mimeType: media.mimetype
  });

  if (savedFile.bytes > 0) {
    void incrementCompanyStorageUsage(companyId, savedFile.bytes);
  }

  const publicImageUrl = buildInstagramPublicMediaUrl(savedFile.relativePath);
  const caption = formatBody(body?.trim() || "", ticket.contact);
  const bodyToSave = caption || "Imagem";

  logger.info(
    {
      ticketId: ticket.id,
      companyId,
      instagramAccountId: account.id,
      recipientId,
      publicImageUrlHost: (() => {
        try {
          return new URL(publicImageUrl).host;
        } catch {
          return undefined;
        }
      })()
    },
    "[InstagramMediaOutbound] sending"
  );

  try {
    const sendResult = await sendInstagramDirectImageMessage(
      businessId,
      recipientId,
      publicImageUrl,
      accessToken
    );

    logger.info(
      {
        ticketId: ticket.id,
        externalMessageId: sendResult.messageId
      },
      "[InstagramMediaOutbound] sent"
    );

    const messageId = sendResult.messageId || uuidv4();

    await ticket.update({ lastMessage: bodyToSave });

    await Message.upsert({
      id: messageId,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body: bodyToSave,
      fromMe: true,
      read: true,
      mediaType: "image",
      mediaUrl: savedFile.relativePath,
      ack: 2,
      channel: "instagram",
      externalMessageId: sendResult.messageId,
      metaPayload: sendResult.rawResponse,
      remoteJid: null,
      dataJson: JSON.stringify(sendResult.rawResponse),
      queueId: ticket.queueId ?? null,
      companyId
    });

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
      "[InstagramMediaOutbound] failed"
    );
    throw mapped.appError;
  }
};

export default SendInstagramImageMessageService;
