import path from "path";
import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import InstagramAccount from "../../models/InstagramAccount";
import { getIO } from "../../libs/socket";
import {
  assertInstagramDocumentUpload,
  buildInstagramPublicMediaUrl,
  moveUploadedFileToInstagramFolder
} from "../../helpers/instagramMediaStorage";
import { isInstagramChannelTicket } from "../../helpers/ticketChannel";
import { logger } from "../../utils/logger";
import { incrementCompanyStorageUsage } from "../CompanyService/adjustCompanyStorageUsage";
import { serializeMessageForClient } from "../MessageServices/CreateMessageService";
import resolveInstagramAccountToken from "./resolveInstagramAccountToken";
import {
  buildInstagramDirectFilePayload,
  extractInstagramDirectSendMetaError,
  mapInstagramOutboundSendError,
  sendInstagramDirectFileMessage
} from "./MetaGraphApiService";

interface Request {
  ticket: Ticket;
  media: Express.Multer.File;
  companyId: number;
}

const logInstagramDocumentMetaError = (
  err: unknown,
  context: Record<string, unknown>
): void => {
  const metaError = extractInstagramDirectSendMetaError(err);
  logger.warn(
    {
      ...context,
      ...metaError
    },
    "[InstagramDocumentOutbound] meta_error"
  );
};

const SendInstagramDocumentMessageService = async ({
  ticket,
  media,
  companyId
}: Request): Promise<Message> => {
  logger.info(
    {
      ticketId: ticket.id,
      companyId,
      channel: ticket.channel,
      filename: media.originalname,
      mimeType: media.mimetype,
      extension: path.extname(media.originalname || ""),
      fileSize: media.size
    },
    "[InstagramDocumentOutbound] upload_received"
  );

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
    assertInstagramDocumentUpload(media);
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    logger.warn(
      {
        ticketId: ticket.id,
        companyId,
        filename: media.originalname,
        mimeType: media.mimetype,
        validationError: code
      },
      "[InstagramDocumentOutbound] failed"
    );
    if (code === "ERR_INSTAGRAM_DOCUMENT_TYPE_BLOCKED") {
      throw new AppError(
        "ERR_INSTAGRAM_DOCUMENT_TYPE_BLOCKED",
        400,
        "Este tipo de arquivo não é permitido no Instagram."
      );
    }
    if (code === "ERR_INSTAGRAM_DOCUMENT_TOO_LARGE") {
      throw new AppError(
        "ERR_INSTAGRAM_DOCUMENT_TOO_LARGE",
        400,
        "Documento muito grande para envio pelo Instagram."
      );
    }
    throw new AppError(
      "ERR_INSTAGRAM_DOCUMENT_FORMAT_UNSUPPORTED",
      400,
      "Formato de documento não suportado pelo Instagram."
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

  const savedFile = moveUploadedFileToInstagramFolder({
    companyId,
    sourcePath: media.path,
    originalName: media.originalname,
    mimeType: media.mimetype,
    basename: path.parse(media.originalname || "document").name || "document"
  });

  if (savedFile.bytes > 0) {
    void incrementCompanyStorageUsage(companyId, savedFile.bytes);
  }

  const publicFileUrl = buildInstagramPublicMediaUrl(savedFile.relativePath);
  const bodyToSave = media.originalname || path.basename(savedFile.relativePath);
  const metaEndpoint = `https://graph.instagram.com/v21.0/${businessId}/messages`;
  const metaPayload = buildInstagramDirectFilePayload(recipientId, publicFileUrl);

  logger.info(
    {
      ticketId: ticket.id,
      companyId,
      instagramAccountId: account.id,
      recipientId,
      filename: media.originalname,
      mimeType: media.mimetype,
      extension: path.extname(savedFile.absolutePath),
      fileSize: savedFile.bytes,
      savedRelativePath: savedFile.relativePath,
      publicUrl: publicFileUrl
    },
    "[InstagramDocumentOutbound] file_info"
  );

  logger.info(
    {
      ticketId: ticket.id,
      companyId,
      instagramAccountId: account.id,
      recipientId,
      filename: media.originalname,
      mimeType: media.mimetype,
      fileSize: savedFile.bytes,
      publicUrl: publicFileUrl,
      metaEndpoint,
      metaPayload
    },
    "[InstagramDocumentOutbound] sending"
  );

  try {
    const sendResult = await sendInstagramDirectFileMessage(
      businessId,
      recipientId,
      publicFileUrl,
      accessToken
    );

    logger.info(
      {
        ticketId: ticket.id,
        companyId,
        externalMessageId: sendResult.messageId,
        metaResponse: sendResult.rawResponse
      },
      "[InstagramDocumentOutbound] meta_response"
    );

    logger.info(
      {
        ticketId: ticket.id,
        externalMessageId: sendResult.messageId
      },
      "[InstagramDocumentOutbound] sent"
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
      mediaType: "document",
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

    const failureContext = {
      ticketId: ticket.id,
      companyId,
      filename: media.originalname,
      mimeType: media.mimetype,
      fileSize: savedFile.bytes,
      publicUrl: publicFileUrl,
      metaEndpoint,
      metaPayload
    };

    logInstagramDocumentMetaError(err, failureContext);

    const mapped = mapInstagramOutboundSendError(err);
    logger.warn(
      {
        ...failureContext,
        mappedAppError: mapped.appError.message,
        mappedStatusCode: mapped.statusCode
      },
      "[InstagramDocumentOutbound] failed"
    );

    if (mapped.appError.message === "ERR_INSTAGRAM_SEND_FAILED") {
      throw new AppError(
        "ERR_INSTAGRAM_DOCUMENT_SEND_FAILED",
        mapped.appError.statusCode,
        "Não foi possível enviar documento pelo Instagram."
      );
    }

    throw mapped.appError;
  }
};

export default SendInstagramDocumentMessageService;
