import AppError from "../../errors/AppError";
import CrmAutomationRule from "../../models/CrmAutomationRule";
import { parseCrmAutomationRuleBody } from "./crmAutomationRuleValidation";

export default async function UpdateCrmAutomationRuleService(input: {
  companyId: number;
  id: number;
  body: unknown;
}): Promise<CrmAutomationRule> {
  const rule = await CrmAutomationRule.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!rule) {
    throw new AppError("ERR_NO_CRM_AUTOMATION_RULE", 404);
  }

  const parsed = await parseCrmAutomationRuleBody(input.body);
  await rule.update({
    name: parsed.name.trim(),
    enabled: parsed.enabled !== false,
    triggerType: parsed.triggerType,
    triggerConfig: (parsed.triggerConfig || {}) as Record<string, unknown>,
    actionType: parsed.actionType,
    actionConfig: (parsed.actionConfig || {}) as Record<string, unknown>
  });
  return rule;
}
