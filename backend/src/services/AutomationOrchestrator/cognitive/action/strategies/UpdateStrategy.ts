import { ActionType } from "../../../../../config/automationActionExecutionConstants";
import { BaseSimulatedStrategy } from "./BaseSimulatedStrategy";
import { ExecutionAction } from "../actionTypes";

export class UpdateStrategy extends BaseSimulatedStrategy {
  readonly name = "UpdateStrategy";
  readonly actionTypes: readonly ActionType[] = ["UPDATE"];

  protected simulateOutput(action: ExecutionAction): Record<string, unknown> {
    return {
      kind: "update",
      fields: action.entities.map(e => e.key),
      simulated: true,
      confirmed: !action.requiresConfirmation,
      usesToolRuntime: false
    };
  }
}

export default new UpdateStrategy();
