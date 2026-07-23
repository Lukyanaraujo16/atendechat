import { ActionType, ActionValidationResult } from "../../../../../config/automationActionExecutionConstants";
import {
  ExecutionStrategy,
  StrategyExecuteContext,
  StrategyPrepareContext
} from "../ExecutionStrategy";
import { ExecutionAction } from "../actionTypes";

export abstract class BaseSimulatedStrategy implements ExecutionStrategy {
  abstract readonly name: string;
  abstract readonly actionTypes: readonly ActionType[];

  supports(action: ExecutionAction): boolean {
    return this.actionTypes.includes(action.actionType);
  }

  async prepare(
    action: ExecutionAction,
    _ctx: StrategyPrepareContext
  ): Promise<Record<string, unknown>> {
    return {
      prepared: true,
      actionType: action.actionType,
      objective: action.objective,
      simulated: true,
      usesToolRuntime: false
    };
  }

  protected async delay(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise(r => setTimeout(r, Math.min(ms, 50)));
  }

  async execute(
    action: ExecutionAction,
    ctx: StrategyExecuteContext,
    prepared: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    await this.delay(ctx.simulateLatencyMs);
    return this.simulateOutput(action, prepared);
  }

  protected abstract simulateOutput(
    action: ExecutionAction,
    prepared: Record<string, unknown>
  ): Record<string, unknown>;

  validate(
    action: ExecutionAction,
    output: Record<string, unknown>
  ): ActionValidationResult {
    if (output.error) return "FAILED";
    if (action.requiresConfirmation && !output.confirmed) return "WAITING";
    if (output.partial) return "PARTIAL";
    return "VALID";
  }

  async cleanup(): Promise<void> {
    // noop — simulated
  }
}
