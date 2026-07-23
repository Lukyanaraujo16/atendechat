import { ActionType } from "../../../../../config/automationActionExecutionConstants";
import { BaseSimulatedStrategy } from "./BaseSimulatedStrategy";
import { ExecutionAction } from "../actionTypes";

export class MessagingStrategy extends BaseSimulatedStrategy {
  readonly name = "MessagingStrategy";
  readonly actionTypes: readonly ActionType[] = ["SEND_MESSAGE"];

  protected simulateOutput(action: ExecutionAction): Record<string, unknown> {
    return {
      kind: "message",
      draft: `[simulado] ${action.objective.slice(0, 120)}`,
      sent: false,
      confirmed: !action.requiresConfirmation,
      usesToolRuntime: false
    };
  }
}

export default new MessagingStrategy();
