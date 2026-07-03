import { Request, Response } from "express";
import path from "path";
import AppError from "../errors/AppError";

import SetTicketMessagesAsRead, {
  HUMAN_PANEL_LIST_MESSAGES,
  HUMAN_PANEL_SEND_MESSAGE
} from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import formatBody from "../helpers/Mustache";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import CreateMessageService, {
  serializeMessageForClient
} from "../services/MessageServices/CreateMessageService";
import {
  assertUserCanAccessTicketResource,
  toTicketAccessPayload
} from "../helpers/ticketAccess";
import {
  logGroupTicketAccessDebug,
  logGroupTicketAccessDebugError,
  probeGroupContactAccess,
  probeWhatsappTicketAccess,
  serializeReqUserForDebug,
  serializeTicketForAccessDebug,
  formatThrownError
} from "../helpers/groupTicketAccessDebug";
import { isGroupTicket } from "../helpers/groupTicketRules";
import { logger } from "../utils/logger";
import {
  getOpenTicketElapsedMs,
  getOpenTicketEnrichDebug,
  getOpenTicketEnrichWarnings
} from "../helpers/openTicketRequestContext";
import { incrementCompanyStorageUsage } from "../services/CompanyService/adjustCompanyStorageUsage";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import { v4 as uuidv4 } from "uuid";
import { isInstagramChannelTicket } from "../helpers/ticketChannel";
import { assertInstagramIntegrationInPlan } from "../helpers/assertInstagramIntegrationInPlan";
import extractMessageUploadMedias from "../helpers/extractMessageUploadMedias";
import SendInstagramTextMessageService from "../services/InstagramAccountService/SendInstagramTextMessageService";
import SendInstagramImageMessageService from "../services/InstagramAccountService/SendInstagramImageMessageService";
import SendInstagramVideoMessageService from "../services/InstagramAccountService/SendInstagramVideoMessageService";
import SendInstagramAudioMessageService from "../services/InstagramAccountService/SendInstagramAudioMessageService";
import SendInstagramDocumentMessageService from "../services/InstagramAccountService/SendInstagramDocumentMessageService";
import {
  assertInstagramImageUpload,
  assertInstagramVideoUpload,
  assertInstagramAudioUpload,
  assertInstagramDocumentUpload,
  INSTAGRAM_ALLOWED_IMAGE_MIMES,
  INSTAGRAM_ALLOWED_VIDEO_MIMES,
  INSTAGRAM_ALLOWED_AUDIO_MIMES,
  isInstagramDocumentUpload
} from "../helpers/instagramMediaStorage";
type IndexQuery = {
  pageNumber: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  closeTicket?: true;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber } = req.query as IndexQuery;
  const { companyId, profile, supportMode, id } = req.user;
  const queues: number[] = [];
  const logBase = {
    ticketId,
    companyId,
    userId: id,
    pageNumber: pageNumber ?? "1"
  };

  logger.info(logBase, "[OpenTicket] show-ticket start");

  const endpoint = "GET /messages/:ticketId";
  try {
    const ticketForAccess = await ShowTicketService(ticketId, companyId);

    logGroupTicketAccessDebug(endpoint, "before_assert", {
      ...logBase,
      ...serializeReqUserForDebug(req.user),
      ...serializeTicketForAccessDebug(ticketForAccess),
      isGroupTicket: isGroupTicket(ticketForAccess)
    });

    const accessUser = { id, profile, supportMode };
    const accessPayload = toTicketAccessPayload(ticketForAccess);
    const numericCompanyId = Number(companyId);

    const whatsappProbe = await probeWhatsappTicketAccess(
      accessPayload,
      accessUser,
      numericCompanyId
    );
    logGroupTicketAccessDebug(endpoint, "probe_whatsapp", whatsappProbe);

    if (isGroupTicket(ticketForAccess) && ticketForAccess.contact) {
      const groupProbe = await probeGroupContactAccess(
        ticketForAccess.contact as any,
        accessUser,
        numericCompanyId
      );
      logGroupTicketAccessDebug(endpoint, "probe_group_contact", groupProbe);
    }

    try {
      await assertUserCanAccessTicketResource(
        accessUser,
        accessPayload,
        numericCompanyId,
        endpoint
      );
    } catch (assertErr) {
      logGroupTicketAccessDebugError(endpoint, "assert_failed", assertErr, {
        ...logBase,
        ...formatThrownError(assertErr)
      });
      throw assertErr;
    }

    if (profile !== "admin" && supportMode !== true) {
      const user = await User.findByPk(req.user.id, {
        include: [{ model: Queue, as: "queues" }]
      });
      user?.queues?.forEach(queue => {
        queues.push(queue.id);
      });
    }

    const { count, messages, ticket, hasMore } = await ListMessagesService({
      pageNumber,
      ticketId,
      companyId,
      queues,
      actorUserId: id,
      ticket: ticketForAccess
    });

    await SetTicketMessagesAsRead(ticket, HUMAN_PANEL_LIST_MESSAGES);

    const enrichWarnings = getOpenTicketEnrichWarnings();
    const enrichDebug = getOpenTicketEnrichDebug();
    const isDev = process.env.NODE_ENV !== "production";

    logger.info(
      {
        ...logBase,
        elapsedMs: getOpenTicketElapsedMs(),
        enrichWarnings: enrichWarnings.length ? enrichWarnings : undefined,
        enrichDebug: enrichDebug.length ? enrichDebug : undefined
      },
      "[OpenTicket] show-ticket success"
    );

    return res.json({
      count,
      messages,
      ticket,
      hasMore,
      ...(enrichWarnings.length ? { enrichWarnings } : {}),
      ...(isDev && enrichDebug.length ? { enrichDebug } : {})
    });
  } catch (error) {
    logger.error(
      {
        ...logBase,
        elapsedMs: getOpenTicketElapsedMs(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      "[OpenTicket] show-ticket failed"
    );
    throw error;
  }
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const sendPerfStartedAt = Date.now();
  const { ticketId } = req.params;
  const { body, quotedMsg }: MessageData = req.body;
  const asSticker = req.body.asSticker === "true" || req.body.asSticker === "1";
  const medias = extractMessageUploadMedias(req);
  const { companyId, profile, supportMode, id } = req.user;
  const sendPerfLog = (
    event: string,
    extra: Record<string, unknown> = {}
  ): void => {
    logger.info(
      {
        ticketId,
        companyId,
        userId: id,
        profile,
        durationMs: Date.now() - sendPerfStartedAt,
        ...extra
      },
      `[SendPerf] ${event}`
    );
  };

  sendPerfLog("controller_start", {
    hasBody: Boolean(body?.trim()),
    mediasCount: medias.length
  });
  const ticket = await ShowTicketService(ticketId, companyId);
  sendPerfLog("after_show_ticket", {
    resolvedTicketId: ticket.id,
    channel: ticket.channel,
    whatsappId: ticket.whatsappId
  });

  const isInstagram = isInstagramChannelTicket(ticket);
  const isWhatsApp = !isInstagram;

  logger.info(
    {
      ticketId: ticket.id,
      channel: ticket.channel,
      whatsappId: ticket.whatsappId,
      hasBody: Boolean(body?.trim()),
      mediasCount: medias.length,
      isInstagram,
      isWhatsApp
    },
    "[MessageController] create_start"
  );

  await assertUserCanAccessTicketResource(
    { id, profile, supportMode },
    toTicketAccessPayload(ticket),
    companyId
  );

  /** Mesma regra do GET da conversa: atendente humano no painel ao enviar resposta. */
  sendPerfLog("before_read_receipt", {
    resolvedTicketId: ticket.id,
    channel: ticket.channel,
    whatsappId: ticket.whatsappId
  });
  await SetTicketMessagesAsRead(ticket, HUMAN_PANEL_SEND_MESSAGE);
  sendPerfLog("after_read_receipt", {
    resolvedTicketId: ticket.id,
    channel: ticket.channel,
    whatsappId: ticket.whatsappId
  });

  if (isInstagram) {
    await assertInstagramIntegrationInPlan(companyId);

    if (asSticker) {
      throw new AppError(
        "ERR_INSTAGRAM_STICKER_NOT_SUPPORTED",
        400,
        "Envio de figurinha pelo Instagram ainda não está disponível."
      );
    }

    if (medias.length) {
      logger.info(
        {
          ticketId: ticket.id,
          companyId,
          channel: ticket.channel,
          filesCount: medias.length,
          mimetypes: medias.map(media => media.mimetype)
        },
        "[InstagramMediaOutbound] upload_received"
      );

      for (const media of medias) {
        const mime = (media.mimetype || "").toLowerCase();
        const isImage = INSTAGRAM_ALLOWED_IMAGE_MIMES.has(mime);
        const isVideo = INSTAGRAM_ALLOWED_VIDEO_MIMES.has(mime);
        const isAudio = INSTAGRAM_ALLOWED_AUDIO_MIMES.has(mime);
        const isDocument = isInstagramDocumentUpload(media);

        if (!isImage && !isVideo && !isAudio && !isDocument) {
          throw new AppError(
            "ERR_INSTAGRAM_MEDIA_TYPE_UNSUPPORTED",
            400,
            "Este tipo de mídia ainda não é suportado no Instagram."
          );
        }

        try {
          if (isDocument) {
            assertInstagramDocumentUpload(media);
          } else if (isAudio) {
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
              "[InstagramAudioOutbound] upload_received"
            );
            assertInstagramAudioUpload(media);
          } else if (isVideo) {
            assertInstagramVideoUpload(media);
          } else {
            assertInstagramImageUpload(media);
          }
        } catch (err) {
          const code = err instanceof Error ? err.message : String(err);
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
          if (code === "ERR_INSTAGRAM_DOCUMENT_FORMAT_UNSUPPORTED") {
            throw new AppError(
              "ERR_INSTAGRAM_DOCUMENT_FORMAT_UNSUPPORTED",
              400,
              "Formato de documento não suportado pelo Instagram."
            );
          }
          if (code === "ERR_INSTAGRAM_AUDIO_TOO_LARGE") {
            throw new AppError(
              "ERR_INSTAGRAM_AUDIO_TOO_LARGE",
              400,
              "Áudio muito grande para envio pelo Instagram."
            );
          }
          if (code === "ERR_INSTAGRAM_AUDIO_FORMAT_UNSUPPORTED") {
            throw new AppError(
              "ERR_INSTAGRAM_AUDIO_FORMAT_UNSUPPORTED",
              400,
              "Formato de áudio não suportado pelo Instagram."
            );
          }
          if (code === "ERR_INSTAGRAM_VIDEO_TOO_LARGE") {
            throw new AppError(
              "ERR_INSTAGRAM_VIDEO_TOO_LARGE",
              400,
              "Vídeo muito grande para envio pelo Instagram."
            );
          }
          if (code === "ERR_INSTAGRAM_VIDEO_FORMAT_UNSUPPORTED") {
            throw new AppError(
              "ERR_INSTAGRAM_VIDEO_FORMAT_UNSUPPORTED",
              400,
              "Formato de vídeo não suportado pelo Instagram."
            );
          }
          throw new AppError(
            "ERR_INSTAGRAM_IMAGE_TOO_LARGE",
            400,
            "Imagem muito grande para envio pelo Instagram."
          );
        }
      }

      const savedMessages = await Promise.all(
        medias.map(async (media: Express.Multer.File, index) => {
          const mime = (media.mimetype || "").toLowerCase();
          const payload = {
            ticket,
            media,
            body: Array.isArray(body) ? body[index] : body,
            companyId
          };

          if (INSTAGRAM_ALLOWED_AUDIO_MIMES.has(mime)) {
            return SendInstagramAudioMessageService(payload);
          }

          if (isInstagramDocumentUpload(media)) {
            return SendInstagramDocumentMessageService({
              ticket,
              media,
              companyId
            });
          }

          if (INSTAGRAM_ALLOWED_VIDEO_MIMES.has(mime)) {
            return SendInstagramVideoMessageService(payload);
          }

          return SendInstagramImageMessageService(payload);
        })
      );

      return res.status(200).json({
        message: serializeMessageForClient(savedMessages[savedMessages.length - 1])
      });
    }

    if (!body?.trim()) {
      throw new AppError("ERR_MESSAGE_BODY_REQUIRED", 400);
    }

    const bodyToSend = formatBody(body, ticket.contact);
    const savedMessage = await SendInstagramTextMessageService({
      ticket,
      body: bodyToSend,
      companyId,
      quotedMsg: quotedMsg ?? null
    });

    return res.status(200).json({
      message: serializeMessageForClient(savedMessage)
    });
  }

  if (medias.length > 0) {
    logger.info(
      {
        ticketId: ticket.id,
        whatsappId: ticket.whatsappId,
        mediasCount: medias.length
      },
      "[MessageController] whatsapp_media_branch"
    );

    await Promise.all(
      medias.map(async (media: Express.Multer.File, index) => {
        await SendWhatsAppMedia({
          media,
          ticket,
          body: Array.isArray(body) ? body[index] : body,
          asSticker
        });
      })
    );
    return res.send();
  }

  logger.info(
    {
      ticketId: ticket.id,
      whatsappId: ticket.whatsappId,
      bodyLength: body?.length ?? 0
    },
    "[MessageController] whatsapp_branch"
  );

  try {
    sendPerfLog("before_whatsapp_send", {
      resolvedTicketId: ticket.id,
      whatsappId: ticket.whatsappId,
      bodyLength: body?.length ?? 0
    });
    const sentMessage = await SendWhatsAppMessage({ body, ticket, quotedMsg });
    sendPerfLog("after_whatsapp_send", {
      resolvedTicketId: ticket.id,
      whatsappId: ticket.whatsappId,
      baileysMessageId: (sentMessage as any)?.key?.id ?? null,
      baileysStatus: (sentMessage as any)?.status ?? null
    });
    const bodyToSave = formatBody(body, ticket.contact);
    const idToSave = (sentMessage as any)?.key?.id || uuidv4();
    sendPerfLog("before_persist_message", {
      resolvedTicketId: ticket.id,
      messageId: idToSave
    });
    const savedMessage = await CreateMessageService({
      messageData: {
        id: idToSave,
        ticketId: ticket.id,
        body: bodyToSave,
        fromMe: true,
        read: true,
        ack: (sentMessage as any)?.status,
        mediaType: "conversation",
        ...(sentMessage ? { dataJson: JSON.stringify(sentMessage as any) } : {})
      } as any,
      companyId: ticket.companyId
    });
    sendPerfLog("after_persist_message", {
      resolvedTicketId: ticket.id,
      messageId: savedMessage.id
    });

    logger.info(
      {
        ticketId: ticket.id,
        messageId: savedMessage.id
      },
      "[MessageController] whatsapp_sent"
    );

    sendPerfLog("response_sent", {
      resolvedTicketId: ticket.id,
      messageId: savedMessage.id
    });
    return res.status(200).json({
      message: serializeMessageForClient(savedMessage)
    });
  } catch (err) {
    sendPerfLog("create_failed", {
      resolvedTicketId: ticket.id,
      channel: ticket.channel,
      errorCode: err instanceof AppError ? err.message : "unknown",
      errorMessage: err instanceof Error ? err.message : String(err)
    });
    logger.warn(
      {
        ticketId: ticket.id,
        channel: ticket.channel,
        errorCode: err instanceof AppError ? err.message : "unknown",
        errorMessage: err instanceof Error ? err.message : String(err)
      },
      "[MessageController] create_failed"
    );
    throw err;
  }
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await DeleteWhatsAppMessage(messageId);

  const io = getIO();
  io.to(message.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message
  });

  return res.send();
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params as unknown as { whatsappId: number };
  const messageData: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      throw new Error("Não foi possível realizar a operação");
    }

    if (messageData.number === undefined) {
      throw new Error("O número é obrigatório");
    }

    const numberToTest = messageData.number;
    const body = messageData.body;

    const companyId = whatsapp.companyId;

    const CheckValidNumber = await CheckContactNumber(numberToTest, companyId);
    const number = CheckValidNumber.jid.replace(/\D/g, "");
    const profilePicUrl = await GetProfilePicUrl(
      number,
      companyId
    );
    const contactData = {
      name: `${number}`,
      number,
      profilePicUrl,
      isGroup: false,
      companyId
    };

    const contact = await CreateOrUpdateContactService(contactData);

    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp.id!,
      0,
      companyId,
      undefined,
      { forceCreate: true, messageReceivedAt: new Date() }
    );

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          if (media.size > 0) {
            void incrementCompanyStorageUsage(companyId, media.size);
          }
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId,
              data: {
                number,
                body: body ? formatBody(body, contact) : media.originalname,
                mediaPath: media.path,
                fileName: media.originalname
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      const formatted = formatBody(body, contact);
      const sentMessage = await SendWhatsAppMessage({ body: formatted, ticket });

      await ticket.update({
        lastMessage: body,
      });
      const idToSave = (sentMessage as any)?.key?.id || uuidv4();
      await CreateMessageService({
        messageData: {
          id: idToSave,
          ticketId: ticket.id,
          body: formatted,
          fromMe: true,
          read: true,
          ack: (sentMessage as any)?.status,
          mediaType: "conversation",
          ...(sentMessage
            ? { dataJson: JSON.stringify(sentMessage as any) }
            : {})
        } as any,
        companyId
      });

    }

    if (messageData.closeTicket) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: ticket.id,
          ticketData: { status: "closed" },
          companyId
        });
      }, 1000);
    }

    SetTicketMessagesAsRead(ticket);

    return res.send({ mensagem: "Mensagem enviada" });
  } catch (err: any) {
    if (err instanceof AppError) {
      throw err;
    }
    const emptyObj =
      err &&
      typeof err === "object" &&
      !Array.isArray(err) &&
      Object.keys(err).length === 0;
    if (emptyObj) {
      throw new AppError(
        "ERR_MESSAGE_SEND_FAILED",
        400,
        "Não foi possível enviar a mensagem, tente novamente em alguns instantes"
      );
    }
    const detail =
      err?.message && typeof err.message === "string"
        ? err.message
        : undefined;
    throw new AppError("ERR_MESSAGE_SEND_FAILED", 400, detail);
  }
};

export const sendMessageFlow = async (
  whatsappId: number,
  body: any,
  req: Request,
  files?: Express.Multer.File[]
): Promise<String> => {
  const messageData = body;
  const medias = files;

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      throw new Error("Não foi possível realizar a operação");
    }

    if (messageData.number === undefined) {
      throw new Error("O número é obrigatório");
    }

    const numberToTest = messageData.number;
    const body = messageData.body;

    const companyId = messageData.companyId;

    const CheckValidNumber = await CheckContactNumber(numberToTest, companyId);
    const number = numberToTest.replace(/\D/g, "");

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          if (media.size > 0) {
            void incrementCompanyStorageUsage(companyId, media.size);
          }
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId,
              data: {
                number,
                body: media.originalname,
                mediaPath: media.path
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId,
          data: {
            number,
            body
          }
        },

        { removeOnComplete: false, attempts: 3 }
      );
    }

    return "Mensagem enviada";
  } catch (err: any) {
    if (Object.keys(err).length === 0) {
      throw new AppError(
        "Não foi possível enviar a mensagem, tente novamente em alguns instantes"
      );
    } else {
      throw new AppError(err.message);
    }
  }
};
