import AppError from "../../errors/AppError";
import CrmAutomationRule from "../../models/CrmAutomationRule";

export default async function DeleteCrmAutomationRuleService(input: {
  companyId: number;
  id: number;
}): Promise<void> {
  const rule = await CrmAutomationRule.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!rule) {
    throw new AppError("ERR_NO_CRM_AUTOMATION_RULE", 404);
  }
  await rule.destroy();
}
