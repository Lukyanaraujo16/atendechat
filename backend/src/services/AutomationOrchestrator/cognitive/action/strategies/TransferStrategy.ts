import { ActionType } from "../../../../../config/automationActionExecutionConstants";
import { BaseSimulatedStrategy } from "./BaseSimulatedStrategy";
import { ExecutionAction } from "../actionTypes";

export class TransferStrategy extends BaseSimulatedStrategy {
  readonly name = "TransferStrategy";
  readonly actionTypes: readonly ActionType[] = ["TRANSFER"];

  protected simulateOutput(action: ExecutionAction): Record<string, unknown> {
    return {
      kind: "transfer",
      target: "human_queue",
      simulated: true,
      confirmed: !action.requiresConfirmation,
      usesToolRuntime: false
    };
  }
}

export default new TransferStrategy();
