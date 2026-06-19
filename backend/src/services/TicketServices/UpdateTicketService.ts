import moment from "moment";
import * as Sentry from "@sentry/node";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import ShowTicketService from "./ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { verifyMessage } from "../WbotServices/wbotMessageListener";
import {
  getGlobalAutoMessagesFallback,
  resolveUserRating,
  resolveWhatsappAutoMessageSettings
} from "../../helpers/whatsappBehaviorSettings";
import ShowUserService from "../UserServices/ShowUserService"; //NOVO PLW DESIGN//
import { isNil } from "lodash";
import Whatsapp from "../../models/Whatsapp";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import { logger } from "../../utils/logger";
import notifyTicketAfterUpdate from "../OneSignalPush/notifyTicketAfterUpdate";
import RemovePinnedTicketsForTicketService from "../PinnedTicketServices/RemovePinnedTicketsForTicketService";
import ensureContactAssignmentForTicketUser from "../ContactServices/ensureContactAssignmentForTicketUser";
import {
  isGroupTicket,
  normalizeGroupTicketUpdate
} from "../../helpers/groupTicketRules";
import {
  isInstagramChannelTicket,
  normalizeOptionalForeignKeyId
} from "../../helpers/ticketChannel";

interface TicketData {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  chatbot?: boolean;
  queueOptionId?: number;
  whatsappId?: string;
  useIntegration?: boolean;
  integrationId?: number | null;
  promptId?: number | null;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
  companyId: number;
  actionUserId?: string | null;
  actorProfile?: string;
  actorSupportMode?: boolean;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

function normalizeUid(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/**
 * Transferências operacionais devem ir para Aguardando (pending), não Atendendo (open).
 */
function applyTransferPendingRules(params: {
  ticketData: TicketData;
  ticket: Ticket;
  actionUserId: string | null;
}): TicketData {
  if (isGroupTicket(params.ticket)) {
    return params.ticketData;
  }

  const { ticketData, ticket, actionUserId } = params;
  const oldStatus = ticket.status;
  const oldUid = normalizeUid(ticket.userId ?? ticket.user?.id);
  const oldQueueId =
    ticket.queueId != null && !Number.isNaN(Number(ticket.queueId))
      ? Number(ticket.queueId)
      : null;

  let status = ticketData.status;
  let userId =
    ticketData.userId !== undefined ? ticketData.userId : ticket.userId;
  let queueId =
    ticketData.queueId !== undefined ? ticketData.queueId : ticket.queueId;
  let chatbot =
    ticketData.chatbot !== undefined ? ticketData.chatbot : ticket.chatbot;
  let queueOptionId =
    ticketData.queueOptionId !== undefined
      ? ticketData.queueOptionId
      : ticket.queueOptionId;
  let useIntegration =
    ticketData.useIntegration !== undefined
      ? ticketData.useIntegration
      : ticket.useIntegration;
  let integrationId =
    ticketData.integrationId !== undefined
      ? ticketData.integrationId
      : ticket.integrationId;
  let promptId =
    ticketData.promptId !== undefined ? ticketData.promptId : ticket.promptId;

  if (status === "closed") {
    return ticketData;
  }

  const newUid = userId !== undefined ? normalizeUid(userId) : oldUid;
  const newQueueId =
    queueId !== undefined && queueId !== null && !Number.isNaN(Number(queueId))
      ? Number(queueId)
      : oldQueueId;

  const userIdInPayload = ticketData.userId !== undefined;
  const queueIdInPayload = ticketData.queueId !== undefined;

  const userChanged =
    userIdInPayload && newUid !== oldUid;
  const queueChanged =
    queueIdInPayload && newQueueId !== oldQueueId;

  const actionUid =
    actionUserId != null && !Number.isNaN(Number(actionUserId))
      ? Number(actionUserId)
      : null;

  const isAcceptingTicket =
    status === "open" &&
    newUid != null &&
    actionUid != null &&
    newUid === actionUid &&
    (oldUid == null || oldStatus === "pending");

  if (isAcceptingTicket) {
    return ticketData;
  }

  const mistakenOpenTransfer =
    status === "open" &&
    userIdInPayload &&
    newUid != null &&
    actionUid != null &&
    newUid !== actionUid;

  const isTransfer = userChanged || queueChanged || mistakenOpenTransfer;

  if (!isTransfer) {
    return ticketData;
  }

  if (status === undefined || status === "open" || mistakenOpenTransfer) {
    status = "pending";
  }

  if (userIdInPayload && ticketData.userId === null) {
    userId = null;
  } else if (queueChanged && !userIdInPayload) {
    userId = null;
  }

  chatbot = false;
  queueOptionId = null;
  useIntegration = false;
  integrationId = null;
  promptId = null;

  return {
    ...ticketData,
    status,
    userId,
    queueId,
    chatbot,
    queueOptionId,
    useIntegration,
    integrationId,
    promptId
  };
}

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  companyId,
  actionUserId = null,
  actorProfile,
  actorSupportMode
}: Request): Promise<Response> => {

  try {
    const io = getIO();

    const ticket = await ShowTicketService(ticketId, companyId);

    const groupSafeData = normalizeGroupTicketUpdate(ticket, ticketData, {
      id: actionUserId ?? 0,
      profile: actorProfile,
      supportMode: actorSupportMode,
      companyId
    });

    const normalizedTicketData = applyTransferPendingRules({
      ticketData: groupSafeData,
      ticket,
      actionUserId
    });

    const { status } = normalizedTicketData;
    let { queueId, userId, whatsappId } = normalizedTicketData;
    let chatbot: boolean | null = normalizedTicketData.chatbot ?? false;
    let queueOptionId: number | null = normalizedTicketData.queueOptionId ?? null;
    let promptId: number | null = normalizeOptionalForeignKeyId(
      normalizedTicketData.promptId
    );
    let integrationId: number | null = normalizeOptionalForeignKeyId(
      normalizedTicketData.integrationId
    );
    let useIntegration: boolean | null = normalizedTicketData.useIntegration ?? false;
    const isInstagram = isInstagramChannelTicket(ticket);
    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId,
      companyId,
      whatsappId: ticket.whatsappId
    });

    if (isNil(whatsappId)) {
      whatsappId =
        ticket.whatsappId != null && ticket.whatsappId !== undefined
          ? String(ticket.whatsappId)
          : undefined;
    }

    const trakingWhatsappId =
      whatsappId != null && `${whatsappId}` !== ""
        ? whatsappId
        : ticket.whatsappId;
    const whatsappIdForDb =
      !isNil(ticketData.whatsappId) && `${ticketData.whatsappId}` !== ""
        ? ticketData.whatsappId
        : ticket.whatsappId;

    await SetTicketMessagesAsRead(ticket);

    const oldStatus = ticket.status;
    const oldUserId = ticket.userId ?? ticket.user?.id;
    const oldQueueId = ticket.queueId;

    const resolvedWhatsappIdForCompare =
      whatsappId != null && `${whatsappId}` !== ""
        ? Number(whatsappId)
        : ticket.whatsappId != null
          ? Number(ticket.whatsappId)
          : null;

    const whatsappIdChanged =
      resolvedWhatsappIdForCompare != null &&
      ticket.whatsappId != null &&
      resolvedWhatsappIdForCompare !== Number(ticket.whatsappId);

    const isAcceptingPending =
      status === "open" && oldStatus === "pending";

    if (
      String(ticket.channel || "").toLowerCase() === "instagram" &&
      isAcceptingPending
    ) {
      const existingOther = await Ticket.findOne({
        where: {
          contactId: ticket.contactId,
          status: { [Op.or]: ["open", "pending"] },
          id: { [Op.ne]: ticket.id }
        },
        attributes: ["id", "status"]
      });

      logger.info(
        {
          ticketId: ticket.id,
          contactId: ticket.contactId,
          channel: ticket.channel,
          existingTicketId: existingOther?.id ?? null,
          existingTicketStatus: existingOther?.status ?? null
        },
        "[InstagramAccept]"
      );
    }

    if (oldStatus === "closed" || whatsappIdChanged) {
      await CheckContactOpenTickets(
        ticket.contact.id,
        whatsappId,
        Number(ticketId)
      );
      chatbot = null;
      queueOptionId = null;
    }

    if (status !== undefined && ["closed"].indexOf(status) > -1) {
      if (isInstagram) {
        logger.info(
          {
            ticketId: ticket.id,
            contactId: ticket.contactId,
            channel: ticket.channel,
            instagramAccountId: ticket.instagramAccountId
          },
          "[InstagramResolve] closing without WhatsApp side-effects"
        );
      } else {
      const whatsappConfig =
        ticket.whatsappId != null
          ? await Whatsapp.findOne({
              where: { id: ticket.whatsappId, companyId },
              attributes: ["complationMessage", "ratingMessage"]
            })
          : null;
      const complationMessage = whatsappConfig?.complationMessage ?? null;
      const ratingMessage = whatsappConfig?.ratingMessage ?? null;

      try {
        const userRatingEnabled =
          (await resolveUserRating(ticket.whatsappId, companyId)) === "enabled";

        if (userRatingEnabled) {
          if (ticketTraking.ratingAt == null) {
            const ratingTxt = ratingMessage || "";
            let bodyRatingMessage = `\u200e${ratingTxt}\n\n`;
            bodyRatingMessage +=
              "Digite de 1 à 3 para qualificar nosso atendimento:\n*1* - _Insatisfeito_\n*2* - _Satisfeito_\n*3* - _Muito Satisfeito_\n\n";
            let ratingSent = false;
            try {
              await SendWhatsAppMessage({ body: bodyRatingMessage, ticket });
              ratingSent = true;
            } catch (sendErr) {
              logger.warn(
                `UpdateTicketService: não foi possível enviar pedido de avaliação (ticket ${ticketId}). Fechamento segue sem avaliação. Err: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
              );
            }

            if (ratingSent) {
              const ratingAssigneeUserId =
                ticket.userId != null ? ticket.userId : actionUserId;
              await ticketTraking.update({
                ratingAt: moment().toDate(),
                userId: ratingAssigneeUserId
              });

              io.to(`company-${ticket.companyId}-open`)
                .to(`queue-${ticket.queueId}-open`)
                .to(`company-${companyId}-mainchannel`)
                .to(ticketId.toString())
                .emit(`company-${ticket.companyId}-ticket`, {
                  action: "delete",
                  ticketId: ticket.id
                });

              return { ticket, oldStatus, oldUserId };
            }
          } else {
            ticketTraking.ratingAt = moment().toDate();
            ticketTraking.rated = false;
          }
        }

        if (!isNil(complationMessage) && complationMessage !== "") {
          try {
            await SendWhatsAppMessage({
              body: `\u200e${complationMessage}`,
              ticket
            });
          } catch (sendErr) {
            logger.warn(
              `UpdateTicketService: não foi possível enviar mensagem de conclusão (ticket ${ticketId}). Err: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
            );
          }
        }
      } catch (err) {
        logger.warn(
          `UpdateTicketService: erro ao processar mensagens de fechamento (ticket ${ticketId}). Ticket será atualizado mesmo assim. Err: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      }
      await ticket.update({
        promptId: null,
        integrationId: null,
        useIntegration: false,
        typebotStatus: false,
        typebotSessionId: null
      });

      ticketTraking.finishedAt = moment().toDate();
      ticketTraking.whatsappId = ticket.whatsappId;
      ticketTraking.userId = ticket.userId;
    }

    if (queueId !== undefined && queueId !== null) {
      ticketTraking.queuedAt = moment().toDate();
    }

    const transferAutoMessages =
      !isInstagram && ticket.whatsappId
      ? await resolveWhatsappAutoMessageSettings(ticket.whatsappId, companyId)
      : await getGlobalAutoMessagesFallback(companyId);

    if (!isInstagram && transferAutoMessages.sendMsgTransfTicket === "enabled") {
      try {
        // Mensagem de transferencia da FILA
        if (oldQueueId !== queueId && oldUserId === userId && !isNil(oldQueueId) && !isNil(queueId)) {

          const { language } = await Company.findByPk(companyId);
          const queue = await Queue.findByPk(queueId);
          const wbot = await GetTicketWbot(ticket);

          const translatedMessage = {
            pt: "*Mensagem automática*:\nVocê foi transferido para o departamento *" + queue?.name + "*\naguarde, já vamos te atender!",
            en: "*Automatic message*:\nYou have been transferred to the *" + queue?.name + "* department\nplease wait, we'll assist you soon!",
            es: "*Mensaje automático*:\nHas sido transferido al departamento *" + queue?.name + "*\npor favor espera, ¡te atenderemos pronto!"
          };

          const queueChangedMessage = await wbot.sendMessage(
            `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            { text: translatedMessage[language] }
          );
          await verifyMessage(queueChangedMessage, ticket, ticket.contact);
        } else if (oldUserId !== userId && oldQueueId === queueId && !isNil(oldUserId) && !isNil(userId)) {
          const { language } = await Company.findByPk(companyId);
          const wbot = await GetTicketWbot(ticket);
          const nome = await ShowUserService(ticketData.userId);

          const translatedMessage = {
            pt: "*Mensagem automática*:\nFoi transferido para o atendente *" + nome.name + "*\naguarde, já vamos te atender!",
            en: "*Automatic message*:\nYou have been transferred to agent *" + nome.name + "*\nplease wait, we'll assist you soon!",
            es: "*Mensaje automático*:\nHas sido transferido al agente *" + nome.name + "*\npor favor espera, ¡te atenderemos pronto!"
          };

          const queueChangedMessage = await wbot.sendMessage(
            `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            { text: translatedMessage[language] }
          );
          await verifyMessage(queueChangedMessage, ticket, ticket.contact);
        } else if (oldUserId !== userId && !isNil(oldUserId) && !isNil(userId) && oldQueueId !== queueId && !isNil(oldQueueId) && !isNil(queueId)) {
          const { language } = await Company.findByPk(companyId);
          const wbot = await GetTicketWbot(ticket);
          const queue = await Queue.findByPk(queueId);
          const nome = await ShowUserService(ticketData.userId);

          const translatedMessage = {
            pt: "*Mensagem automática*:\nVocê foi transferido para o departamento *" + queue?.name + "* e contará com a presença de *" + nome.name + "*\naguarde, já vamos te atender!",
            en: "*Automatic message*:\nYou have been transferred to the *" + queue?.name + "* department and will be assisted by *" + nome.name + "*\nplease wait, we'll assist you soon!",
            es: "*Mensaje automático*:\nHas sido transferido al departamento *" + queue?.name + "* y serás atendido por *" + nome.name + "*\npor favor espera, ¡te atenderemos pronto!"
          };

          const queueChangedMessage = await wbot.sendMessage(
            `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            { text: translatedMessage[language] }
          );
          await verifyMessage(queueChangedMessage, ticket, ticket.contact);
        } else if (oldUserId !== undefined && isNil(userId) && oldQueueId !== queueId && !isNil(queueId)) {
          const { language } = await Company.findByPk(companyId);
          const queue = await Queue.findByPk(queueId);
          const wbot = await GetTicketWbot(ticket);

          const translatedMessage = {
            pt: "*Mensagem automática*:\nVocê foi transferido para o departamento *" + queue?.name + "*\naguarde, já vamos te atender!",
            en: "*Automatic message*:\nYou have been transferred to the *" + queue?.name + "* department\nplease wait, we'll assist you soon!",
            es: "*Mensaje automático*:\nHas sido transferido al departamento *" + queue?.name + "*\npor favor espera, ¡te atenderemos pronto!"
          };

          const queueChangedMessage = await wbot.sendMessage(
            `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
            { text: translatedMessage[language] }
          );
          await verifyMessage(queueChangedMessage, ticket, ticket.contact);
        }
      } catch (err) {
        logger.warn(
          `UpdateTicketService: WhatsApp desconectado ao enviar mensagem de transferência (ticket ${ticketId}). Ticket será atualizado mesmo assim. Err: ${err?.message || err}`
        );
      }
    }

    await ticket.update({
      status,
      queueId,
      userId,
      whatsappId: whatsappIdForDb,
      chatbot,
      queueOptionId,
      useIntegration,
      integrationId,
      promptId
    });

    if (status !== undefined && status !== "open") {
      await RemovePinnedTicketsForTicketService(Number(ticketId));
    }

    const ticketForEmit = await ShowTicketService(ticketId, companyId);

    if (status !== undefined && ["pending"].indexOf(status) > -1) {
      ticketTraking.update({
        whatsappId: trakingWhatsappId,
        queuedAt: moment().toDate(),
        startedAt: null,
        userId: null
      });
    }

    if (status !== undefined && ["open"].indexOf(status) > -1) {
      ticketTraking.update({
        startedAt: moment().toDate(),
        ratingAt: null,
        rated: false,
        whatsappId: trakingWhatsappId,
        userId: ticketForEmit.userId
      });
    }

    await ticketTraking.save();

    const statusChanged = ticketForEmit.status !== oldStatus;
    const oldChatbot = Boolean(ticket.chatbot);
    const newChatbot = Boolean(ticketForEmit.chatbot);
    const oldUid =
      oldUserId != null && oldUserId !== undefined && !Number.isNaN(Number(oldUserId))
        ? Number(oldUserId)
        : null;
    const newUid =
      ticketForEmit.userId != null &&
      ticketForEmit.userId !== undefined &&
      !Number.isNaN(Number(ticketForEmit.userId))
        ? Number(ticketForEmit.userId)
        : null;
    const assigneeChanged = oldUid !== newUid;

    /**
     * Delete amplo quando o status muda (ex.: pending → open).
     * Em pending→pending (FlowBuilder) não emitir delete global — só update.
     * Transferência de responsável: delete direcionado ao userId anterior.
     */
    if (statusChanged) {
      let deleteEmitter = io
        .to(`company-${companyId}-${oldStatus}`)
        .to(`company-${companyId}-mainchannel`)
        .to(`user-${oldUserId}`);
      if (oldQueueId != null) {
        deleteEmitter = deleteEmitter.to(`queue-${oldQueueId}-${oldStatus}`);
      }
      deleteEmitter.emit(`company-${companyId}-ticket`, {
        action: "delete",
        ticketId: ticketForEmit.id
      });
    } else if (assigneeChanged && oldUid != null) {
      io.to(`user-${oldUid}`).emit(`company-${companyId}-ticket`, {
        action: "delete",
        ticketId: ticketForEmit.id
      });
    }

    const emitRooms = [
      `company-${companyId}-${ticketForEmit.status}`,
      `company-${companyId}-notification`,
      `company-${companyId}-mainchannel`,
      `queue-${ticketForEmit.queueId}-${ticketForEmit.status}`,
      `queue-${ticketForEmit.queueId}-notification`,
      String(ticketId),
      `user-${ticketForEmit?.userId}`,
      `user-${oldUserId}`
    ];

    logger.info(
      {
        ticketId: ticketForEmit.id,
        companyId,
        status: ticketForEmit.status,
        chatbot: ticketForEmit.chatbot,
        queueId: ticketForEmit.queueId,
        userId: ticketForEmit.userId,
        statusChanged,
        assigneeChanged,
        chatbotChanged: oldChatbot !== newChatbot,
        oldStatus,
        oldUserId: oldUid,
        oldQueueId,
        action: "update",
        rooms: emitRooms.filter((r) => r && !r.includes("undefined") && !r.includes("null"))
      },
      "[UpdateTicketService][socket] emit company-ticket update"
    );

    io.to(`company-${companyId}-${ticketForEmit.status}`)
      .to(`company-${companyId}-notification`)
      .to(`company-${companyId}-mainchannel`)
      .to(`queue-${ticketForEmit.queueId}-${ticketForEmit.status}`)
      .to(`queue-${ticketForEmit.queueId}-notification`)
      .to(ticketId.toString())
      .to(`user-${ticketForEmit?.userId}`)
      .to(`user-${oldUserId}`)
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket: ticketForEmit
      });

    void notifyTicketAfterUpdate({
      companyId,
      ticket: ticketForEmit,
      oldStatus,
      oldQueueId,
      oldUserId
    });

    if (!isGroupTicket(ticketForEmit)) {
      await ensureContactAssignmentForTicketUser({
        contactId: ticketForEmit.contactId,
        userId: ticketForEmit.userId,
        companyId,
        ticketStatus: ticketForEmit.status,
        assignedByUserId:
          actionUserId != null ? Number(actionUserId) : ticketForEmit.userId
      });
    }

    return { ticket: ticketForEmit, oldStatus, oldUserId };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
};

export default UpdateTicketService;
