import cron from "node-cron";
import { Op } from "sequelize";
import CrmDeal from "../models/CrmDeal";
import CrmStage from "../models/CrmStage";
import Contact from "../models/Contact";
import User from "../models/User";
import CreateCrmNotificationService from "../services/NotificationService/CreateCrmNotificationService";
import { logger } from "../utils/logger";
import {
  CRM_ATTENTION_REASON_NO_ACTIVITY_3D,
  CRM_STALE_ATTENTION_DAYS
} from "../config/crmAttention";
import runConfigurableStaleCrmAutomationRules from "../services/CrmAutomationRule/runConfigurableStaleCrmAutomationRules";
import CreateCrmDealActivityService from "../services/CrmService/CreateCrmDealActivityService";

const LOG_PREFIX = "[CRM Attention]";
const MS_PER_DAY = 86400000;

export async function runCrmStaleDealAttentionJob(): Promise<void> {
  const now = new Date();
  const threshold = new Date(Date.now() - CRM_STALE_ATTENTION_DAYS * MS_PER_DAY);

  const deals = await CrmDeal.findAll({
    where: {
      status: "open",
      attentionAt: { [Op.is]: null },
      [Op.or]: [
        { lastActivityAt: { [Op.lte]: threshold } },
        {
          lastActivityAt: { [Op.is]: null },
          createdAt: { [Op.lte]: threshold }
        }
      ]
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
    order: [
      ["lastActivityAt", "ASC"],
      ["createdAt", "ASC"]
    ]
  });

  for (const deal of deals) {
    try {
      const fresh = await CrmDeal.findOne({
        where: {
          id: deal.id,
          status: "open",
          attentionAt: { [Op.is]: null },
          [Op.or]: [
            { lastActivityAt: { [Op.lte]: threshold } },
            {
              lastActivityAt: { [Op.is]: null },
              createdAt: { [Op.lte]: threshold }
            }
          ]
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
            `${LOG_PREFIX} assignee_missing`
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

      const [markedRows] = await CrmDeal.update(
        {
          attentionAt: now,
          attentionReason: CRM_ATTENTION_REASON_NO_ACTIVITY_3D,
          attentionNotifiedAt: null
        },
        {
          where: {
            id: fresh.id,
            status: "open",
            attentionAt: { [Op.is]: null }
          }
        }
      );

      if (!markedRows) {
        logger.info({ dealId: fresh.id }, `${LOG_PREFIX} skip_already_marked`);
        continue;
      }

      await CreateCrmDealActivityService({
        companyId: fresh.companyId,
        dealId: fresh.id,
        userId: null,
        type: "attention_marked",
        title: "attention_marked",
        metadata: {
          reason: CRM_ATTENTION_REASON_NO_ACTIVITY_3D,
          source: "fixed_job_no_activity_3d"
        }
      });

      const dealTitle = String(fresh.title || "").trim() || "—";
      const contactName =
        fresh.contact?.name != null ? String(fresh.contact.name) : "";

      const data: Record<string, unknown> = {
        type: "crm_deal_needs_attention",
        dealId: fresh.id,
        dealTitle,
        companyId,
        contactName,
        attentionReason: CRM_ATTENTION_REASON_NO_ACTIVITY_3D
      };

      let anyDelivered = false;

      for (const userId of uniqueRecipients) {
        const row = await CreateCrmNotificationService({
          userId,
          companyId,
          type: "crm_deal_needs_attention",
          title: "Item do CRM parado",
          body: `"${dealTitle}" está sem atualização há mais de 3 dias.`,
          data
        });
        if (row) {
          anyDelivered = true;
        }
      }

      if (anyDelivered) {
        await CrmDeal.update(
          { attentionNotifiedAt: now },
          { where: { id: fresh.id } }
        );
      }

      logger.info(
        {
          dealId: fresh.id,
          companyId,
          recipients: uniqueRecipients.length,
          notified: anyDelivered
        },
        `${LOG_PREFIX} processed`
      );
    } catch (err) {
      logger.warn({ err, dealId: deal.id }, `${LOG_PREFIX} deal_failed`);
    }
  }

  try {
    await runConfigurableStaleCrmAutomationRules();
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} configurable_rules_failed`);
  }
}

let running = false;

/** A cada 30 minutos — deals abertos parados há N dias (lote máx. 100). */
export function startCrmStaleDealAttentionScheduler(): void {
  cron.schedule("*/30 * * * *", async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await runCrmStaleDealAttentionJob();
    } catch (e) {
      logger.warn({ err: e }, `${LOG_PREFIX} job_failed`);
    } finally {
      running = false;
    }
  });
}
