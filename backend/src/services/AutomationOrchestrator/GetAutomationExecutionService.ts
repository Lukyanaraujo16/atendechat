import AppError from "../../errors/AppError";
import AutomationExecution from "../../models/AutomationExecution";
import AutomationExecutionStep from "../../models/AutomationExecutionStep";
import AutomationExecutionEvent from "../../models/AutomationExecutionEvent";
import AutomationPlannerValidation from "../../models/AutomationPlannerValidation";

export type GetAutomationExecutionInput = {
  companyId: number;
  executionId: number;
};

export default async function GetAutomationExecutionService(
  input: GetAutomationExecutionInput
): Promise<AutomationExecution> {
  const execution = await AutomationExecution.findOne({
    where: {
      id: input.executionId,
      companyId: input.companyId
    },
    include: [
      {
        model: AutomationExecutionStep,
        as: "steps",
        separate: true,
        order: [["stepIndex", "ASC"]]
      },
      {
        model: AutomationExecutionEvent,
        as: "events",
        separate: true,
        order: [["createdAt", "ASC"]]
      },
      {
        model: AutomationPlannerValidation,
        as: "plannerValidation",
        required: false
      }
    ]
  });

  if (!execution) {
    throw new AppError("ERR_AUTOMATION_EXECUTION_NOT_FOUND", 404);
  }

  return execution;
}
