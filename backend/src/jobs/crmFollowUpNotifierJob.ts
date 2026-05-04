import cron from "node-cron";
import { Op } from "sequelize";
import CrmDeal from "../models/CrmDeal";
import CrmStage from "../models/CrmStage";
import Contact from "../models/Contact";
import User from "../models/User";
import CreateCrmNotificationService from "../services/NotificationService/CreateCrmNotificationService";
import { logger } from "../utils/logger";

const LOG_PREFIX = "[CRM FollowUp]";

/**
 * Processa até 100 deals com follow-up vencido ainda não notificados.
 * Etapa não pode ser ganha nem perdida; não altera deals se não houver destinatários.
 */
export async function runCrmFollowUpNotifierJob(): Promise<void> {
  const now = new Date();

  const deals = await CrmDeal.findAll({
    where: {
      nextFollowUpAt: { [Op.lte]: now },
      followUpNotifiedAt: { [Op.is]: null }
    },
    include: [
      {
        model: CrmStage,
        required: true,
        where: { isWon: false, isLost: false }
      },
      {
        model: Contact,
        as: "contact",
        required: false,
        attributes: ["id", "name"]
      }
    ],
    limit: 100,
    order: [["nextFollowUpAt", "ASC"]]
  });

  for (const deal of deals) {
    try {
      const fresh = await CrmDeal.findOne({
        where: {
          id: deal.id,
          followUpNotifiedAt: { [Op.is]: null },
          nextFollowUpAt: { [Op.lte]: now }
        },
        include: [
          {
            model: CrmStage,
            required: true,
            where: { isWon: false, isLost: false }
          },
          {
            model: Contact,
            as: "contact",
            required: false,
            attributes: ["id", "name"]
          }
        ]
      });

      if (!fresh) {
        continue;
      }

      const companyId = fresh.companyId;
      const recipientIds: number[] = [];

      if (fresh.assignedUserId != null) {
        const assignee = await User.findOne({
          where: { id: fresh.assignedUserId, companyId },
          attributes: ["id"]
        });
        if (assignee) {
          recipientIds.push(assignee.id);
        } else {
          logger.warn(
            { dealId: fresh.id, assignedUserId: fresh.assignedUserId, companyId },
            `${LOG_PREFIX} assignee_missing_or_other_company`
          );
        }
      }

      if (recipientIds.length === 0) {
        const admins = await User.findAll({
          where: { companyId, profile: "admin" },
          attributes: ["id"]
        });
        admins.forEach((a) => recipientIds.push(a.id));
      }

      const uniqueRecipients = [...new Set(recipientIds)];

      if (uniqueRecipients.length === 0) {
        logger.warn({ dealId: fresh.id, companyId }, `${LOG_PREFIX} no_recipients`);
        continue;
      }

      const dealTitle = String(fresh.title || "").trim() || "—";
      const contactName = fresh.contact?.name != null ? String(fresh.contact.name) : "";

      const data: Record<string, unknown> = {
        type: "crm_followup_overdue",
        dealId: fresh.id,
        dealTitle,
        companyId,
        contactName,
        nextFollowUpAt: fresh.nextFollowUpAt
          ? new Date(fresh.nextFollowUpAt).toISOString()
          : null
      };

      let anyDelivered = false;

      for (const userId of uniqueRecipients) {
        const row = await CreateCrmNotificationService({
          userId,
          companyId,
          type: "crm_followup_overdue",
          title: "Follow-up atrasado",
          body: `${dealTitle} precisa de atenção`,
          data
        });
        if (row) {
          anyDelivered = true;
        }
      }

      if (anyDelivered) {
        const [affected] = await CrmDeal.update(
          { followUpNotifiedAt: new Date() },
          {
            where: {
              id: fresh.id,
              followUpNotifiedAt: { [Op.is]: null }
            }
          }
        );
        logger.info(
          { dealId: fresh.id, companyId, recipients: uniqueRecipients.length, updated: affected },
          `${LOG_PREFIX} notified`
        );
      } else {
        logger.warn({ dealId: fresh.id, companyId }, `${LOG_PREFIX} no_notification_delivered`);
      }
    } catch (err) {
      logger.warn({ err, dealId: deal.id }, `${LOG_PREFIX} deal_failed`);
    }
  }
}

let running = false;

/** A cada 10 minutos — follow-ups vencidos (lote máx. 100). */
export function startCrmFollowUpNotifierScheduler(): void {
  cron.schedule("*/10 * * * *", async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await runCrmFollowUpNotifierJob();
    } catch (e) {
      logger.warn({ err: e }, `${LOG_PREFIX} job_failed`);
    } finally {
      running = false;
    }
  });
}
