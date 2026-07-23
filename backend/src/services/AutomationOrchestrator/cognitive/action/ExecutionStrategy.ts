import { ActionType, ActionValidationResult } from "../../../../config/automationActionExecutionConstants";
import {
  ExecutionAction,
  ActionExecutionResult
} from "./actionTypes";

export type StrategyPrepareContext = {
  companyId?: number;
  sessionId?: string;
};

export type StrategyExecuteContext = StrategyPrepareContext & {
  simulateLatencyMs: number;
};

/**
 * ExecutionStrategy — interface plugável.
 * Nenhuma implementação deve usar Tool Runtime ou Providers.
 */
export interface ExecutionStrategy {
  readonly name: string;
  readonly actionTypes: readonly ActionType[];

  supports(action: ExecutionAction): boolean;

  prepare(
    action: ExecutionAction,
    ctx: StrategyPrepareContext
  ): Promise<Record<string, unknown>>;

  execute(
    action: ExecutionAction,
    ctx: StrategyExecuteContext,
    prepared: Record<string, unknown>
  ): Promise<Record<string, unknown>>;

  validate(
    action: ExecutionAction,
    output: Record<string, unknown>
  ): ActionValidationResult;

  cleanup(
    action: ExecutionAction,
    output: Record<string, unknown>
  ): Promise<void>;
}

export type { ActionValidationResult, ExecutionAction, ActionExecutionResult };
