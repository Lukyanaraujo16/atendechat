import { ActionType } from "../../../../../config/automationActionExecutionConstants";
import { BaseSimulatedStrategy } from "./BaseSimulatedStrategy";
import { ExecutionAction } from "../actionTypes";

export class ValidateStrategy extends BaseSimulatedStrategy {
  readonly name = "ValidateStrategy";
  readonly actionTypes: readonly ActionType[] = ["VALIDATE"];

  protected simulateOutput(action: ExecutionAction): Record<string, unknown> {
    return {
      kind: "validate",
      valid: true,
      checks: action.constraints.length || 1,
      usesToolRuntime: false
    };
  }
}

export default new ValidateStrategy();
