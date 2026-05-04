import CrmDeal from "../../models/CrmDeal";
import CrmStage from "../../models/CrmStage";
import CrmAutomationRule from "../../models/CrmAutomationRule";
import executeCrmAutomationAction from "./executeCrmAutomationAction";
import { normalizeDealPriority } from "../CrmService/crmDealTags";

export type AutomationRunContext = {
  toStageId?: number;
  fromPriority?: string;
  toPriority?: string;
};

function isOpenPipelineStage(stage: CrmStage | null | undefined): boolean {
  if (!stage) return false;
  return !stage.isWon && !stage.isLost;
}

function ruleMatchesTrigger(
  rule: CrmAutomationRule,
  deal: CrmDeal,
  dealStage: CrmStage | null,
  ctx: AutomationRunContext
): boolean {
  const tc = rule.triggerConfig || {};

  if (rule.triggerType === "stage_changed") {
    const sid = Number(tc.stageId);
    if (!Number.isFinite(sid)) return false;
    return ctx.toStageId === sid;
  }

  if (rule.triggerType === "priority_changed") {
    if (deal.status !== "open" || !isOpenPipelineStage(dealStage)) {
      return false;
    }
    const from =
      ctx.fromPriority != null ? normalizeDealPriority(ctx.fromPriority) : null;
    const to =
      ctx.toPriority != null ? normalizeDealPriority(ctx.toPriority) : null;
    if (from === null || to === null || from === to) {
      return false;
    }
    const expected =
      tc.priority != null && String(tc.priority).trim() !== ""
        ? normalizeDealPriority(tc.priority)
        : null;
    if (expected != null) {
      return to === expected;
    }
    return true;
  }

  return false;
}

export default async function RunCrmAutomationRulesForDealService(params: {
  companyId: number;
  dealId: number;
  triggerType: string;
  context: AutomationRunContext;
}): Promise<void> {
  const { companyId, dealId, triggerType, context } = params;

  const deal = await CrmDeal.findOne({
    where: { id: dealId, companyId },
    include: [{ model: CrmStage, required: false }]
  });
  if (!deal) {
    return;
  }

  const dealStage = (deal as CrmDeal & { stage?: CrmStage }).stage ?? null;

  if (triggerType === "priority_changed") {
    if (deal.status !== "open" || !isOpenPipelineStage(dealStage)) {
      return;
    }
  }

  const rules = await CrmAutomationRule.findAll({
    where: { companyId, enabled: true, triggerType },
    order: [["id", "ASC"]]
  });

  for (const rule of rules) {
    if (!ruleMatchesTrigger(rule, deal, dealStage, context)) {
      continue;
    }
    await executeCrmAutomationAction(deal, rule);
    await deal.reload({
      include: [{ model: CrmStage, required: false }]
    });
  }
}
