import AutomationPlannerValidation from "../../models/AutomationPlannerValidation";

export type ListAutomationValidationsInput = {
  companyId: number;
  matched?: boolean;
  divergenceSeverity?: string;
  limit?: number;
  offset?: number;
};

export default async function ListAutomationValidationsService(
  input: ListAutomationValidationsInput
) {
  const where: Record<string, unknown> = {
    companyId: input.companyId
  };

  if (input.matched != null) {
    where.matched = input.matched;
  }
  if (input.divergenceSeverity) {
    where.divergenceSeverity = input.divergenceSeverity;
  }

  const limit = Math.min(100, Math.max(1, input.limit || 20));
  const offset = Math.max(0, input.offset || 0);

  return AutomationPlannerValidation.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });
}
