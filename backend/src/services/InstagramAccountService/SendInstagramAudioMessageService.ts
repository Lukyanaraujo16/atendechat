import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import InstagramAccount from "../../models/InstagramAccount";
import { getIO } from "../../libs/socket";
import formatBody from "../../helpers/Mustache";
import {
  assertInstagramAudioUpload,
  buildInstagramPublicMediaUrl,
  moveUploadedFileToInstagramFolder
} from "../../helpers/instagramMediaStorage";
import { isInstagramChannelTicket } from "../../helpers/ticketChannel";
import { logger } from "../../utils/logger";
import { incrementCompanyStorageUsage } from "../CompanyService/adjustCompanyStorageUsage";
import { serializeMessageForClient } from "../MessageServices/CreateMessageService";
import resolveInstagramAccountToken from "./resolveInstagramAccountToken";
import {
  isInstagramAudioFormatError,
  isInstagramMediaTooLargeError,
  mapInstagramOutboundSendError,
  sendInstagramDirectAudioMessage
} from "./MetaGraphApiService";

interface Request {
  ticket: Ticket;
  media: Express.Multer.File;
  body?: string;
  companyId: number;
}

const SendInstagramAudioMessageService = async ({
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
    assertInstagramAudioUpload(media);
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (code === "ERR_INSTAGRAM_AUDIO_TOO_LARGE") {
      throw new AppError(
        "ERR_INSTAGRAM_AUDIO_TOO_LARGE",
        400,
        "Áudio muito grande para envio pelo Instagram."
      );
    }
    throw new AppError(
      "ERR_INSTAGRAM_AUDIO_FORMAT_UNSUPPORTED",
      400,
      "Formato de áudio não suportado pelo Instagram."
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
    "[InstagramAudioOutbound] saving"
  );

  const savedFile = moveUploadedFileToInstagramFolder({
    companyId,
    sourcePath: media.path,
    originalName: media.originalname,
    mimeType: media.mimetype,
    basename: "audio"
  });

  if (savedFile.bytes > 0) {
    void incrementCompanyStorageUsage(companyId, savedFile.bytes);
  }

  const publicAudioUrl = buildInstagramPublicMediaUrl(savedFile.relativePath);
  const caption = formatBody(body?.trim() || "", ticket.contact);
  const bodyToSave = caption || "Áudio";

  logger.info(
    {
      ticketId: ticket.id,
      companyId,
      instagramAccountId: account.id,
      recipientId,
      publicAudioUrlHost: (() => {
        try {
          return new URL(publicAudioUrl).host;
        } catch {
          return undefined;
        }
      })()
    },
    "[InstagramAudioOutbound] sending"
  );

  try {
    const sendResult = await sendInstagramDirectAudioMessage(
      businessId,
      recipientId,
      publicAudioUrl,
      accessToken
    );

    logger.info(
      {
        ticketId: ticket.id,
        externalMessageId: sendResult.messageId
      },
      "[InstagramAudioOutbound] sent"
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
      mediaType: "audio",
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

    if (isInstagramMediaTooLargeError(err)) {
      throw new AppError(
        "ERR_INSTAGRAM_AUDIO_TOO_LARGE",
        400,
        "Áudio muito grande para envio pelo Instagram."
      );
    }

    if (isInstagramAudioFormatError(err)) {
      throw new AppError(
        "ERR_INSTAGRAM_AUDIO_FORMAT_UNSUPPORTED",
        400,
        "Formato de áudio não suportado pelo Instagram."
      );
    }

    const mapped = mapInstagramOutboundSendError(err);
    if (mapped.appError.message === "ERR_INSTAGRAM_SEND_FAILED") {
      throw new AppError(
        "ERR_INSTAGRAM_AUDIO_SEND_FAILED",
        mapped.appError.statusCode,
        "Não foi possível enviar áudio pelo Instagram."
      );
    }

    logger.warn(
      {
        ticketId: ticket.id,
        statusCode: mapped.statusCode,
        metaErrorCode: mapped.metaCode,
        metaErrorMessage: mapped.metaMessage
      },
      "[InstagramAudioOutbound] failed"
    );
    throw mapped.appError;
  }
};

export default SendInstagramAudioMessageService;
