import { ActionType } from "../../../../../config/automationActionExecutionConstants";
import { BaseSimulatedStrategy } from "./BaseSimulatedStrategy";
import { ExecutionAction } from "../actionTypes";
import { ActionValidationResult } from "../ExecutionStrategy";

export class ConfirmationStrategy extends BaseSimulatedStrategy {
  readonly name = "ConfirmationStrategy";
  readonly actionTypes: readonly ActionType[] = ["WAIT_CONFIRMATION"];

  protected simulateOutput(action: ExecutionAction): Record<string, unknown> {
    return {
      kind: "confirmation",
      awaiting: true,
      confirmed: false,
      prompt: action.expectedOutcome || action.objective,
      usesToolRuntime: false
    };
  }

  validate(
    action: ExecutionAction,
    output: Record<string, unknown>
  ): ActionValidationResult {
    if (!output.confirmed) return "WAITING";
    return super.validate(action, output);
  }
}

export default new ConfirmationStrategy();
