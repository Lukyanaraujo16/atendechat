import { ActionType } from "../../../../../config/automationActionExecutionConstants";
import { BaseSimulatedStrategy } from "./BaseSimulatedStrategy";
import { ExecutionAction } from "../actionTypes";
import { ActionValidationResult } from "../ExecutionStrategy";

export class InputStrategy extends BaseSimulatedStrategy {
  readonly name = "InputStrategy";
  readonly actionTypes: readonly ActionType[] = ["WAIT_INPUT"];

  protected simulateOutput(action: ExecutionAction): Record<string, unknown> {
    return {
      kind: "input",
      awaiting: true,
      received: false,
      prompt: action.expectedOutcome || action.objective,
      usesToolRuntime: false
    };
  }

  validate(
    _action: ExecutionAction,
    output: Record<string, unknown>
  ): ActionValidationResult {
    if (!output.received) return "WAITING";
    return "VALID";
  }
}

export default new InputStrategy();
