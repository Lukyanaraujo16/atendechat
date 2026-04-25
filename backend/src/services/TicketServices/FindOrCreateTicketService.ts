import { subHours } from "date-fns";
import moment from "moment";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import Whatsapp from "../../models/Whatsapp";
import { isFlowBuilderDebugEnabled } from "../../utils/flowBuilderDebug";
import { logger } from "../../utils/logger";
import { parseTicketDataWebhook } from "../../helpers/GetTicketRemoteJid";

export interface FindOrCreateTicketOptions {
  /** Somente conversas 1:1; não usar em grupos. */
  newTicketStatus?: "pending" | "open";
  startedOutsideSystem?: boolean;
  externalStartLog?: {
    remoteJid?: string;
    messageId?: string;
  };
}

function mergeStartedOutsideIntoDataWebhook(
  current: unknown
): Record<string, unknown> {
  const base = parseTicketDataWebhook(current);
  return { ...base, startedOutsideSystem: true };
}

function logExternalStart(
  companyId: number,
  whatsappId: number,
  contactId: number,
  ticketId: number,
  remoteJid: string | undefined,
  messageId: string | undefined
): void {
  logger.info(
    `[TicketExternalStart] created_from_outbound_whatsapp companyId=${companyId} whatsappId=${whatsappId} contactId=${contactId} ticketId=${ticketId} remoteJid=${remoteJid ?? ""} messageId=${messageId ?? ""}`
  );
}

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  companyId: number,
  groupContact?: Contact,
  options?: FindOrCreateTicketOptions
): Promise<Ticket> => {
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending", "closed"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      companyId,
      whatsappId
    },
    order: [["id", "DESC"]]
  });

  if (ticket) {
    await ticket.update({
      unreadMessages,
      whatsappId,
      ...(groupContact
        ? { chatbot: false, useIntegration: false, integrationId: null, promptId: null }
        : {})
    });
  }

  if (ticket?.status === "closed") {
    await ticket.update({
      queueId: null,
      userId: null,
      ...(groupContact
        ? { chatbot: false, useIntegration: false, integrationId: null, promptId: null }
        : {})
    });
  }

  if (!ticket && groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages,
        queueId: null,
        companyId,
        chatbot: false,
        useIntegration: false,
        integrationId: null,
        promptId: null
      });
      await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
      });
    }
  }

  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId: contact.id,
        companyId,
        whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      const reopenOpen =
        options?.startedOutsideSystem && options?.newTicketStatus === "open";
      await ticket.update({
        status: reopenOpen ? "open" : "pending",
        userId: null,
        unreadMessages,
        queueId: null,
        companyId,
        ...(reopenOpen
          ? {
              chatbot: false,
              useIntegration: false,
              integrationId: null,
              promptId: null,
              queueOptionId: null,
              dataWebhook: mergeStartedOutsideIntoDataWebhook(ticket.dataWebhook) as any
            }
          : {})
      });
      const ticketTraking = await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
      });
      if (reopenOpen) {
        await ticketTraking.update({ startedAt: moment().toDate() });
      }
      if (options?.startedOutsideSystem) {
        logExternalStart(
          companyId,
          whatsappId,
          contact.id,
          ticket.id,
          options.externalStartLog?.remoteJid,
          options.externalStartLog?.messageId
        );
      }
    }
  }

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId }
  });

  if (!ticket) {
    if (isFlowBuilderDebugEnabled()) {
      logger.info(
        {
          findOrCreateTicketService: true,
          action: "Ticket.create",
          contactId: groupContact ? groupContact.id : contact.id,
          contactNumber: groupContact ? groupContact.number : contact.number,
          whatsappId,
          companyId
        },
        "[FlowBuilder][debug] FindOrCreateTicketService: novo ticket criado no banco"
      );
    }

    const initialStatus = groupContact
      ? "pending"
      : options?.newTicketStatus ?? "pending";

    const outboundMeta =
      !groupContact &&
      options?.startedOutsideSystem &&
      initialStatus === "open";

    try {
      ticket = await Ticket.create({
        contactId: groupContact ? groupContact.id : contact.id,
        status: initialStatus,
        isGroup: !!groupContact,
        ...(groupContact ? { chatbot: false } : {}),
        ...(outboundMeta
          ? {
              chatbot: false,
              useIntegration: false,
              integrationId: null,
              promptId: null,
              queueId: null as any,
              userId: null as any,
              queueOptionId: null as any,
              dataWebhook: { startedOutsideSystem: true } as any
            }
          : {}),
        unreadMessages,
        whatsappId,
        whatsapp,
        companyId
      });
    } catch (err) {
      logger.error(
        {
          err,
          stack: err instanceof Error ? err.stack : undefined,
          companyId,
          whatsappId,
          contactId: groupContact ? groupContact.id : contact.id
        },
        `[WhatsAppInbound] error_processing context=FindOrCreateTicketService.Ticket.create`
      );
      throw err;
    }

    logger.info(
      `[WhatsAppInbound] ticket_created ticketId=${ticket.id} companyId=${companyId} contactId=${groupContact ? groupContact.id : contact.id} whatsappId=${whatsappId} status=${initialStatus}`
    );

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId,
      userId: ticket.userId
    });
    if (initialStatus === "open") {
      await ticketTraking.update({ startedAt: moment().toDate() });
    }
    if (outboundMeta) {
      logExternalStart(
        companyId,
        whatsappId,
        contact.id,
        ticket.id,
        options.externalStartLog?.remoteJid,
        options.externalStartLog?.messageId
      );
    }
  }

  try {
    ticket = await ShowTicketService(ticket.id, companyId);
  } catch (err) {
    logger.error(
      {
        err,
        stack: err instanceof Error ? err.stack : undefined,
        ticketId: ticket.id,
        companyId
      },
      `[WhatsAppInbound] error_processing context=FindOrCreateTicketService.ShowTicketService`
    );
    throw err;
  }

  return ticket;
};

export default FindOrCreateTicketService;
