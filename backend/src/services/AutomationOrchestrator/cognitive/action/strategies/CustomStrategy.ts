import { ActionType } from "../../../../../config/automationActionExecutionConstants";
import { BaseSimulatedStrategy } from "./BaseSimulatedStrategy";
import { ExecutionAction } from "../actionTypes";

export class CustomStrategy extends BaseSimulatedStrategy {
  readonly name = "CustomStrategy";
  readonly actionTypes: readonly ActionType[] = ["CUSTOM"];

  protected simulateOutput(action: ExecutionAction): Record<string, unknown> {
    return {
      kind: "custom",
      objective: action.objective,
      outcome: action.expectedOutcome,
      simulated: true,
      usesToolRuntime: false
    };
  }
}

export default new CustomStrategy();
