import CrmAutomationRule from "../../models/CrmAutomationRule";

export default async function ListCrmAutomationRulesService(input: {
  companyId: number;
}): Promise<CrmAutomationRule[]> {
  return CrmAutomationRule.findAll({
    where: { companyId: input.companyId },
    order: [["id", "ASC"]]
  });
}
