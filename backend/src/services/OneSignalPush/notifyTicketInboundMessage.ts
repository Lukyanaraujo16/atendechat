import Message from "../../models/Message";
import { logger } from "../../utils/logger";
import { acquireTicketPushDedupe } from "./pushDedupe";
import SendOneSignalPushNotificationService from "./SendOneSignalPushNotificationService";
import {
  resolveRecipientsForInboundMessage,
  resolveRecipientsForPendingOrQueue
} from "./ResolveTicketPushRecipientsService";

const BODY_PREVIEW_MAX = 140;

function truncate(s: string, max: number): string {
  if (!s) return "";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function contactLabel(ticket: {
  contact?: { name?: string; number?: string } | null;
}): string {
  const c = ticket.contact;
  if (!c) return "";
  return (c.name && String(c.name).trim()) || String(c.number || "").trim() || "";
}

/**
 * Push para mensagem inbound (e “nova conversa aguardando” na primeira mensagem pending).
 * Chamado após persistência + emit socket; falhas não propagam.
 */
const notifyTicketInboundMessage = async ({
  message,
  companyId
}: {
  message: Message;
  companyId: number;
}): Promise<void> => {
  try {
    if (message.fromMe === true) {
      return;
    }

    const ticket = message.ticket as typeof message.ticket & {
      companyId?: number;
      uuid?: string;
      status?: string;
      userId?: number | null;
      queueId?: number | null;
      queue?: { name?: string } | null;
    };

    if (!ticket || ticket.companyId !== companyId) {
      return;
    }

    const dedupeKey = `msg:${message.id}`;
    const acquired = await acquireTicketPushDedupe(dedupeKey, 120);
    if (!acquired) {
      logger.info(
        {
          eventType: "ticket_message_inbound",
          companyId,
          ticketId: ticket.id,
          messageId: message.id,
          skipped: "dedupe_message"
        },
        "[OneSignalPush]"
      );
      return;
    }

    const count = await Message.count({ where: { ticketId: ticket.id } });
    const isFirstMessage = count <= 1;
    const pending = ticket.status === "pending";
    const hasAssignee =
      ticket.userId != null && !Number.isNaN(Number(ticket.userId));

    let eventType: string;
    let title: string;
    let dataType: string;
    let recipientIds: number[];

    if (pending && isFirstMessage && !hasAssignee) {
      eventType = "ticket_pending_new";
      title = "Nova conversa aguardando";
      dataType = "ticket_pending";
      recipientIds = await resolveRecipientsForPendingOrQueue(
        companyId,
        ticket.queueId != null ? Number(ticket.queueId) : null
      );
    } else {
      eventType = "ticket_message_inbound";
      title = "Cliente respondeu";
      dataType = "ticket_message";
      recipientIds = await resolveRecipientsForInboundMessage(companyId, {
        userId: ticket.userId,
        queueId: ticket.queueId
      });
    }

    const label = contactLabel(ticket);
    const queueName = ticket.queue?.name ? String(ticket.queue.name) : "";
    const preview = truncate(message.body || "", BODY_PREVIEW_MAX);

    let body = label;
    if (preview) {
      body = label ? `${label} — ${preview}` : preview;
    }
    if (queueName) {
      body = body ? `${body} · ${queueName}` : queueName;
    }
    if (!body) {
      body = `Ticket #${ticket.id}`;
    }

    const preferenceCategory =
      eventType === "ticket_pending_new" ? "new_ticket" : "message";

    await SendOneSignalPushNotificationService({
      eventType,
      preferenceCategory,
      companyId,
      ticketId: ticket.id,
      messageId: message.id,
      recipientUserIds: recipientIds,
      title,
      body,
      data: {
        type: dataType,
        ticketId: ticket.id,
        ticketUuid: ticket.uuid,
        companyId,
        status: String(ticket.status || "")
      }
    });
  } catch (err) {
    logger.warn(
      { err, companyId, messageId: message?.id },
      "[OneSignalPush] notifyTicketInboundMessage"
    );
  }
};

export default notifyTicketInboundMessage;
