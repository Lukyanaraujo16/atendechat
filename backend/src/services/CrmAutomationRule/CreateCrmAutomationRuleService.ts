import CrmAutomationRule from "../../models/CrmAutomationRule";
import { parseCrmAutomationRuleBody } from "./crmAutomationRuleValidation";

export default async function CreateCrmAutomationRuleService(input: {
  companyId: number;
  body: unknown;
}): Promise<CrmAutomationRule> {
  const parsed = await parseCrmAutomationRuleBody(input.body);
  const row = await CrmAutomationRule.create({
    companyId: input.companyId,
    name: parsed.name.trim(),
    enabled: parsed.enabled !== false,
    triggerType: parsed.triggerType,
    triggerConfig: (parsed.triggerConfig || {}) as Record<string, unknown>,
    actionType: parsed.actionType,
    actionConfig: (parsed.actionConfig || {}) as Record<string, unknown>
  });
  return row;
}
