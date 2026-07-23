import { createHash } from "crypto";
import {
  ActionEngineEventName,
  ActionExecutionStatus,
  ActionType,
  ActionValidationResult
} from "../../../../config/automationActionExecutionConstants";
import { getActionExecutionConfig, getStrategyConfig } from "./ActionExecutionConfig";
import { ExecutionStrategyRegistry, defaultStrategyRegistry } from "./ExecutionStrategyRegistry";
import {
  ActionEngineEvent,
  ActionExecutionResult,
  ExecutionAction
} from "./actionTypes";

export type ActionExecutionEngineOptions = {
  companyId?: number;
  sessionId?: string;
  registry?: ExecutionStrategyRegistry;
  onEvent?: (event: ActionEngineEvent) => void;
};

function newEventId(actionId: string, name: string): string {
  return `aevt_${createHash("sha256")
    .update(`${actionId}:${name}:${Date.now()}`)
    .digest("hex")
    .slice(0, 12)}`;
}

function statusFromValidation(
  validation: ActionExecutionResult["validation"],
  output: Record<string, unknown>
): ActionExecutionStatus {
  if (validation === "WAITING") return "WAITING";
  if (validation === "FAILED" || output.error) return "FAILED";
  if (validation === "PARTIAL") return "SUCCESS";
  return "SUCCESS";
}

export class ActionExecutionEngine {
  private readonly registry: ExecutionStrategyRegistry;
  private readonly companyId?: number;
  private readonly sessionId?: string;
  private readonly onEvent?: (event: ActionEngineEvent) => void;

  constructor(options: ActionExecutionEngineOptions = {}) {
    this.registry = options.registry || defaultStrategyRegistry;
    this.companyId = options.companyId;
    this.sessionId = options.sessionId;
    this.onEvent = options.onEvent;
  }

  private emit(
    actionId: string,
    name: ActionEngineEventName,
    message?: string,
    meta?: Record<string, unknown>
  ): ActionEngineEvent {
    const event: ActionEngineEvent = {
      id: newEventId(actionId, name),
      actionId,
      name,
      at: new Date().toISOString(),
      message,
      meta
    };
    this.onEvent?.(event);
    return event;
  }

  async execute(action: ExecutionAction): Promise<{
    result: ActionExecutionResult;
    events: ActionEngineEvent[];
  }> {
    const events: ActionEngineEvent[] = [];
    const push = (
      name: ActionEngineEventName,
      message?: string,
      meta?: Record<string, unknown>
    ) => {
      events.push(this.emit(action.id, name, message, meta));
    };

    const strategy = this.registry.resolve(action);
    if (!strategy) {
      const finishedAt = new Date().toISOString();
      push("ACTION_FAILED", "Nenhuma strategy registrada para o actionType");
      return {
        result: {
          actionId: action.id,
          stepId: action.stepId,
          actionType: action.actionType,
          strategy: "none",
          status: "FAILED",
          startedAt: finishedAt,
          finishedAt,
          duration: 0,
          output: {},
          validation: "FAILED",
          metrics: { retries: 0, simulatedLatencyMs: 0 },
          errors: [`Strategy não encontrada para ${action.actionType}`],
          warnings: [],
          metadata: { usesToolRuntime: false, executesTools: false }
        },
        events
      };
    }

    const config = getActionExecutionConfig(this.companyId);
    const strategyConfig = getStrategyConfig(this.companyId, action.actionType);
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    let retries = 0;
    let output: Record<string, unknown> = {};
    let validation: ActionExecutionResult["validation"] = "VALID";
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const prepared = await strategy.prepare(action, {
        companyId: this.companyId,
        sessionId: this.sessionId
      });
      push("ACTION_PREPARED", strategy.name, { prepared });
      push("ACTION_STARTED", strategy.name);

      const runOnce = async () =>
        strategy.execute(
          action,
          {
            companyId: this.companyId,
            sessionId: this.sessionId,
            simulateLatencyMs: config.simulateLatencyMs
          },
          prepared
        );

      output = await runOnce();

      while (
        retries < strategyConfig.maxRetries &&
        (output.error || output.retry)
      ) {
        retries += 1;
        output = await runOnce();
      }

      if (strategyConfig.validationEnabled) {
        validation = strategy.validate(action, output);
      }

      await strategy.cleanup(action, output);

      const status = statusFromValidation(validation, output);
      const finishedAt = new Date().toISOString();

      if (status === "WAITING") {
        push("ACTION_WAITING", "Aguardando confirmação ou input", { validation });
      } else if (status === "FAILED") {
        push("ACTION_FAILED", "Execução simulada falhou", { validation });
      } else {
        push("ACTION_COMPLETED", "Execução simulada concluída", { validation });
      }

      return {
        result: {
          actionId: action.id,
          stepId: action.stepId,
          actionType: action.actionType,
          strategy: strategy.name,
          status,
          startedAt,
          finishedAt,
          duration: Date.now() - startMs,
          output,
          validation,
          metrics: {
            retries,
            simulatedLatencyMs: config.simulateLatencyMs
          },
          errors,
          warnings,
          metadata: {
            usesToolRuntime: false,
            executesTools: false,
            timeoutMs: strategyConfig.timeoutMs
          }
        },
        events
      };
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      push("ACTION_FAILED", message);
      await strategy.cleanup(action, output).catch(() => undefined);
      return {
        result: {
          actionId: action.id,
          stepId: action.stepId,
          actionType: action.actionType,
          strategy: strategy.name,
          status: "FAILED",
          startedAt,
          finishedAt,
          duration: Date.now() - startMs,
          output,
          validation: "FAILED",
          metrics: { retries, simulatedLatencyMs: config.simulateLatencyMs },
          errors,
          warnings,
          metadata: { usesToolRuntime: false, executesTools: false }
        },
        events
      };
    }
  }
}

const STEP_TYPE_TO_ACTION: Record<string, ActionType> = {
  analyze: "VALIDATE",
  gather_context: "SEARCH",
  search: "SEARCH",
  compose_answer: "CUSTOM",
  update_entity: "UPDATE",
  transfer: "TRANSFER",
  send_message: "SEND_MESSAGE",
  schedule: "CUSTOM",
  confirm: "WAIT_CONFIRMATION",
  automation: "CUSTOM",
  custom: "CUSTOM"
};

export function mapStepToExecutionAction(input: {
  stepId: string;
  stepType: string;
  objective: string;
  requiresConfirmation?: boolean;
  retryable?: boolean;
  entities?: Array<{ key: string; value: string }>;
  constraints?: string[];
  expectedOutcome?: string;
  metadata?: Record<string, unknown>;
}): ExecutionAction {
  const actionType =
    STEP_TYPE_TO_ACTION[input.stepType] || "CUSTOM";
  return {
    id: `act_${createHash("sha256")
      .update(`${input.stepId}:${input.stepType}`)
      .digest("hex")
      .slice(0, 12)}`,
    stepId: input.stepId,
    actionType,
    objective: input.objective,
    entities: input.entities || [],
    constraints: input.constraints || [],
    expectedOutcome: input.expectedOutcome || "",
    requiresConfirmation: Boolean(input.requiresConfirmation),
    retryable: input.retryable !== false,
    metadata: {
      stepType: input.stepType,
      ...(input.metadata || {})
    }
  };
}

export default ActionExecutionEngine;
