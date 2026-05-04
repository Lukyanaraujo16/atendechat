import { Op } from "sequelize";
import CrmDeal from "../../models/CrmDeal";
import CrmStage from "../../models/CrmStage";
import CrmAutomationRule from "../../models/CrmAutomationRule";
import Contact from "../../models/Contact";
import executeCrmAutomationAction from "./executeCrmAutomationAction";
import { normalizeDealPriority } from "../CrmService/crmDealTags";
import { logger } from "../../utils/logger";

const MS_PER_DAY = 86400000;
const LOG_PREFIX = "[CRM Automation stale]";

export default async function runConfigurableStaleCrmAutomationRules(): Promise<void> {
  const rules = await CrmAutomationRule.findAll({
    where: { enabled: true, triggerType: "stale_for_days" },
    order: [
      ["companyId", "ASC"],
      ["id", "ASC"]
    ]
  });

  for (const rule of rules) {
    const tc = rule.triggerConfig || {};
    const days = Math.max(1, Math.min(365, Number(tc.days) || 1));
    const threshold = new Date(Date.now() - days * MS_PER_DAY);

    const stageFilter =
      tc.stageId != null && Number.isFinite(Number(tc.stageId))
        ? Number(tc.stageId)
        : null;
    const priorityFilter =
      tc.priority != null && String(tc.priority).trim() !== ""
        ? normalizeDealPriority(tc.priority)
        : null;

    const staleOr: unknown[] = [
      { lastActivityAt: { [Op.lte]: threshold } },
      {
        lastActivityAt: { [Op.is]: null },
        createdAt: { [Op.lte]: threshold }
      }
    ];

    const whereBase: Record<string, unknown> = {
      companyId: rule.companyId,
      status: "open",
      [Op.or]: staleOr
    };

    if (stageFilter != null) {
      whereBase.stageId = stageFilter;
    }
    if (priorityFilter != null) {
      whereBase.priority = priorityFilter;
    }

    if (rule.actionType === "mark_attention") {
      whereBase.attentionAt = { [Op.is]: null };
    } else if (rule.actionType === "notify_user") {
      whereBase.automationLastStaleNotifyAt = { [Op.is]: null };
    } else {
      continue;
    }

    const deals = await CrmDeal.findAll({
      where: whereBase,
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
      limit: 80,
      order: [
        ["lastActivityAt", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    for (const deal of deals) {
      try {
        const activityTs = deal.lastActivityAt ?? deal.createdAt;
        if (activityTs > threshold) {
          continue;
        }

        if (rule.actionType === "mark_attention" && deal.attentionAt) {
          continue;
        }
        if (rule.actionType === "notify_user" && deal.automationLastStaleNotifyAt) {
          continue;
        }

        const fresh = await CrmDeal.findOne({
          where: {
            id: deal.id,
            companyId: rule.companyId,
            status: "open",
            ...(rule.actionType === "mark_attention"
              ? { attentionAt: { [Op.is]: null } }
              : {}),
            ...(rule.actionType === "notify_user"
              ? { automationLastStaleNotifyAt: { [Op.is]: null } }
              : {})
          },
          include: [
            {
              model: CrmStage,
              required: true,
              where: { isWon: false, isLost: false }
            }
          ]
        });

        if (!fresh) {
          continue;
        }

        const actTs = fresh.lastActivityAt ?? fresh.createdAt;
        if (actTs > threshold) {
          continue;
        }

        await executeCrmAutomationAction(fresh, rule, {
          recordStaleNotificationDedupe: rule.actionType === "notify_user"
        });

        logger.info(
          { dealId: fresh.id, ruleId: rule.id, companyId: rule.companyId },
          `${LOG_PREFIX} applied`
        );
      } catch (err) {
        logger.warn({ err, dealId: deal.id, ruleId: rule.id }, `${LOG_PREFIX} failed`);
      }
    }
  }
}
