import { Op } from "sequelize";
import AutomationExecution from "../../models/AutomationExecution";

export type ListAutomationExecutionsInput = {
  companyId: number;
  ticketId?: number;
  status?: string | string[];
  intent?: string;
  controlMode?: string;
  limit?: number;
  offset?: number;
};

export default async function ListAutomationExecutionsService(
  input: ListAutomationExecutionsInput
): Promise<{ rows: AutomationExecution[]; count: number }> {
  const where: Record<string, unknown> = {
    companyId: input.companyId
  };

  if (input.ticketId != null) where.ticketId = input.ticketId;
  if (input.intent) where.intent = input.intent;
  if (input.controlMode) where.controlMode = input.controlMode;
  if (input.status) {
    where.status = Array.isArray(input.status)
      ? { [Op.in]: input.status }
      : input.status;
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);

  const { rows, count } = await AutomationExecution.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset
  });

  return { rows, count };
}
