import CrmDeal from "../../models/CrmDeal";
import CrmAutomationRule from "../../models/CrmAutomationRule";
import CreateCrmNotificationService from "../NotificationService/CreateCrmNotificationService";
import resolveCrmDealNotifyRecipientIds from "./resolveCrmDealNotifyRecipientIds";
import {
  CRM_ATTENTION_REASON_AUTOMATION_RULE,
  CRM_ATTENTION_REASON_AUTOMATION_STALE
} from "../../config/crmAttention";
import CreateCrmDealActivityService from "../CrmService/CreateCrmDealActivityService";

function normalizeFollowUpNote(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, 65535);
}

export type ExecuteCrmAutomationOptions = {
  /** Só para batch stale_for_days + notify_user — grava `automationLastStaleNotifyAt`. */
  recordStaleNotificationDedupe?: boolean;
};

async function logAutomationTriggered(
  deal: CrmDeal,
  rule: CrmAutomationRule
): Promise<void> {
  await CreateCrmDealActivityService({
    companyId: deal.companyId,
    dealId: deal.id,
    userId: null,
    type: "automation_triggered",
    title: "automation_triggered",
    metadata: {
      ruleId: rule.id,
      ruleName: rule.name,
      triggerType: rule.triggerType,
      actionType: rule.actionType
    }
  });
}

/**
 * Executa uma única ação de automação sobre o deal (linha já validada pelo gatilho).
 */
export default async function executeCrmAutomationAction(
  deal: CrmDeal,
  rule: CrmAutomationRule,
  options?: ExecuteCrmAutomationOptions
): Promise<void> {
  const actionType = String(rule.actionType || "");
  const cfg = rule.actionConfig || {};

  if (actionType === "create_follow_up") {
    const days = Math.max(0, Number(cfg.days) || 1);
    const ms = days * 86400000;
    const next = new Date(Date.now() + ms);
    await deal.update({
      nextFollowUpAt: next,
      followUpNote: normalizeFollowUpNote(cfg.note) ?? null,
      followUpNotifiedAt: null
    });
    await logAutomationTriggered(deal, rule);
    return;
  }

  if (actionType === "mark_attention") {
    const reasonFromConfig = cfg.reason;
    const reasonCode =
      typeof reasonFromConfig === "string" && reasonFromConfig.trim()
        ? String(reasonFromConfig).trim().slice(0, 128)
        : rule.triggerType === "stale_for_days"
          ? CRM_ATTENTION_REASON_AUTOMATION_STALE
          : CRM_ATTENTION_REASON_AUTOMATION_RULE;
    const now = new Date();
    await deal.update({
      attentionAt: now,
      attentionReason: reasonCode,
      attentionNotifiedAt: null
    });
    await logAutomationTriggered(deal, rule);
    return;
  }

  if (actionType === "notify_user") {
    const recipientIds = await resolveCrmDealNotifyRecipientIds(deal);
    if (!recipientIds.length) {
      return;
    }

    const dealTitle = String(deal.title || "").trim() || "—";
    const ruleTitle = String(rule.name || "").trim() || "CRM";
    const data: Record<string, unknown> = {
      type: "crm_automation_rule",
      dealId: deal.id,
      dealTitle,
      companyId: deal.companyId,
      ruleId: rule.id,
      ruleName: rule.name,
      triggerType: rule.triggerType
    };

    let anyDelivered = false;
    const body = `A regra “${ruleTitle}” foi aplicada ao negócio “${dealTitle}”.`;

    for (const userId of recipientIds) {
      const row = await CreateCrmNotificationService({
        userId,
        companyId: deal.companyId,
        type: "crm_automation_rule",
        title: ruleTitle,
        body,
        data
      });
      if (row) {
        anyDelivered = true;
      }
    }

    if (options?.recordStaleNotificationDedupe && anyDelivered) {
      await deal.update({ automationLastStaleNotifyAt: new Date() });
    }
    await logAutomationTriggered(deal, rule);
  }
}
