import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import { acquireTicketPushDedupe } from "./pushDedupe";
import SendOneSignalPushNotificationService from "./SendOneSignalPushNotificationService";
import { PushPreferenceCategory } from "./userPushPreferences";
import { resolveRecipientsForPendingOrQueue } from "./ResolveTicketPushRecipientsService";

function contactLabel(ticket: Ticket): string {
  const c = ticket.contact as { name?: string; number?: string } | undefined;
  if (!c) return "";
  return (c.name && String(c.name).trim()) || String(c.number || "").trim() || "";
}

function normQueueId(v: number | null | undefined): number | null {
  if (v === undefined || v === null) return null;
  return Number(v);
}

function normUserId(v: number | null | undefined): number | null {
  if (v === undefined || v === null) return null;
  return Number(v);
}

/**
 * Push após atualização de ticket (transferência, atribuição, voltou a pending).
 * Uma notificação por utilizador por pedido (prioridade: atribuição > transferência > pending).
 */
const notifyTicketAfterUpdate = async ({
  companyId,
  ticket,
  oldStatus,
  oldQueueId,
  oldUserId
}: {
  companyId: number;
  ticket: Ticket;
  oldStatus: string;
  oldQueueId: number | null;
  oldUserId: number | undefined | null;
}): Promise<void> => {
  try {
    if (ticket.companyId !== companyId) {
      return;
    }

    const newStatus = ticket.status;
    const newQueueId = normQueueId(ticket.queueId);
    const newUserId =
      normUserId(ticket.userId) ??
      normUserId(ticket.user?.id ?? undefined);

    const oldQ = normQueueId(oldQueueId);
    const oldU = normUserId(oldUserId ?? undefined);

    const assignChanged =
      newUserId != null && (oldU == null || newUserId !== oldU);
    const queueChanged = newQueueId !== oldQ;
    const becamePending =
      newStatus === "pending" && oldStatus !== "pending";

    if (!assignChanged && !queueChanged && !becamePending) {
      return;
    }

    const claimed = new Set<number>();
    const label = contactLabel(ticket);
    const queueName =
      (ticket.queue as { name?: string } | undefined)?.name || "";

    const sendBlock = async (opts: {
      dedupeKey: string;
      eventType: string;
      preferenceCategory: PushPreferenceCategory;
      userIds: number[];
      title: string;
      body: string;
      dataType: string;
      dedupeTtl: number;
    }): Promise<void> => {
      const fresh = opts.userIds.filter(
        id => id != null && !Number.isNaN(id) && !claimed.has(id)
      );
      fresh.forEach(id => claimed.add(id));
      if (!fresh.length) {
        return;
      }
      const acquired = await acquireTicketPushDedupe(opts.dedupeKey, opts.dedupeTtl);
      if (!acquired) {
        logger.info(
          {
            eventType: opts.eventType,
            companyId,
            ticketId: ticket.id,
            skipped: "dedupe_ticket_update",
            dedupeKey: opts.dedupeKey
          },
          "[OneSignalPush]"
        );
        return;
      }
      await SendOneSignalPushNotificationService({
        eventType: opts.eventType,
        preferenceCategory: opts.preferenceCategory,
        companyId,
        ticketId: ticket.id,
        messageId: null,
        recipientUserIds: fresh,
        title: opts.title,
        body: opts.body,
        data: {
          type: opts.dataType,
          ticketId: ticket.id,
          ticketUuid: ticket.uuid,
          companyId,
          status: newStatus
        }
      });
    };

    if (assignChanged && newUserId != null) {
      await sendBlock({
        dedupeKey: `assign:${ticket.id}:${newUserId}`,
        eventType: "ticket_assigned",
        preferenceCategory: "assigned",
        userIds: [newUserId],
        title: "Atendimento atribuído a você",
        body: label || queueName || `Ticket #${ticket.id}`,
        dataType: "ticket_assigned",
        dedupeTtl: 60
      });
    }

    if (queueChanged) {
      const transferRecipients = await resolveRecipientsForPendingOrQueue(
        companyId,
        newQueueId
      );
      await sendBlock({
        dedupeKey: `transfer:${ticket.id}:${oldQ ?? "null"}:${newQueueId ?? "null"}`,
        eventType: "ticket_queue_transfer",
        preferenceCategory: "transfer",
        userIds: transferRecipients,
        title: "Ticket transferido",
        body: [
          label,
          newQueueId != null && queueName
            ? `Setor: ${queueName}`
            : "Sem setor"
        ]
          .filter(Boolean)
          .join(" · ") || `Ticket #${ticket.id}`,
        dataType: "ticket_transfer",
        dedupeTtl: 45
      });
    }

    if (becamePending) {
      const pendingRecipients = await resolveRecipientsForPendingOrQueue(
        companyId,
        newQueueId
      );
      await sendBlock({
        dedupeKey: `pending:${ticket.id}`,
        eventType: "ticket_returned_pending",
        preferenceCategory: "new_ticket",
        userIds: pendingRecipients,
        title: "Ticket aguardando",
        body:
          (label ? `${label} — ` : "") +
          (queueName ? `Fila: ${queueName}` : "Sem setor"),
        dataType: "ticket_returned_pending",
        dedupeTtl: 45
      });
    }
  } catch (err) {
    logger.warn(
      { err, companyId, ticketId: ticket?.id },
      "[OneSignalPush] notifyTicketAfterUpdate"
    );
  }
};

export default notifyTicketAfterUpdate;
