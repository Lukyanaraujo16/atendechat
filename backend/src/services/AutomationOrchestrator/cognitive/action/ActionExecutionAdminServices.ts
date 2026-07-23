import { createHash } from "crypto";
import {
  ActionExecutionEngine,
  mapStepToExecutionAction
} from "./ActionExecutionEngine";
import {
  getActionExecutionConfig,
  setActionExecutionConfig
} from "./ActionExecutionConfig";
import { defaultStrategyRegistry } from "./ExecutionStrategyRegistry";
import {
  findActionExecutionResult,
  getActionExecutionMetrics,
  listActionExecutionResults,
  recordActionExecutionResult
} from "./ActionExecutionMetrics";
import {
  ActionExecutionReplaySlice,
  ActionExecutionResult,
  ExecutionAction
} from "./actionTypes";
import { ExecutionReplayRecord } from "../execution/executionTypes";
import { ReplayExecutionSessionService } from "../execution/ExecutionOrchestratorAdminServices";

const actionReplaysByCompany = new Map<
  number,
  Array<{
    id: string;
    sessionId?: string;
    actions: ActionExecutionReplaySlice[];
    createdAt: string;
  }>
>();

const MAX_REPLAYS = 100;

function pushCap<T>(arr: T[], item: T, max = MAX_REPLAYS): void {
  arr.push(item);
  if (arr.length > max) arr.shift();
}

export async function ExecuteActionService(input: {
  companyId: number;
  action?: ExecutionAction;
  sessionId?: string;
  stepId?: string;
  stepType?: string;
  objective?: string;
}): Promise<{
  result: ActionExecutionResult;
  events: ActionExecutionReplaySlice["events"];
}> {
  let action = input.action;
  if (!action) {
    if (!input.stepId || !input.stepType) {
      throw new Error("action ou stepId+stepType obrigatórios");
    }
    action = mapStepToExecutionAction({
      stepId: input.stepId,
      stepType: input.stepType,
      objective: input.objective || "ação simulada"
    });
  }

  const engine = new ActionExecutionEngine({
    companyId: input.companyId,
    sessionId: input.sessionId
  });
  const { result, events } = await engine.execute(action);
  recordActionExecutionResult(result);
  return { result, events };
}

export async function ListStrategiesService() {
  return {
    strategies: defaultStrategyRegistry.list(),
    usesToolRuntime: false
  };
}

export async function ListActionResultsService(input: {
  companyId: number;
  limit?: number;
}) {
  return {
    results: listActionExecutionResults(input.limit || 50),
    metrics: getActionExecutionMetrics()
  };
}

export async function GetActionResultService(input: {
  companyId: number;
  id: string;
}) {
  const result = findActionExecutionResult(input.id);
  if (!result) {
    return { result: null };
  }
  return { result };
}

export async function GetActionExecutionDashboardService(input: {
  companyId: number;
}) {
  const metrics = getActionExecutionMetrics();
  const strategies = defaultStrategyRegistry.list();
  return {
    strategies: strategies.length,
    successRate: metrics.successRate,
    failures: Math.round(metrics.failureRate * metrics.actionsExecuted),
    waiting: Math.round(metrics.waitingRate * metrics.actionsExecuted),
    validation: metrics.validationRate,
    metrics,
    usesToolRuntime: false
  };
}

export async function GetActionExecutionConfigService(input: {
  companyId: number;
}) {
  return { config: getActionExecutionConfig(input.companyId) };
}

export async function UpsertActionExecutionConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  return {
    config: setActionExecutionConfig(input.companyId, input.config)
  };
}

export async function ReplayActionExecutionService(input: {
  companyId: number;
  sessionId?: string;
  text?: string;
}): Promise<{
  replay: ExecutionReplayRecord & {
    actionExecutions: ActionExecutionReplaySlice[];
  };
}> {
  const { replay } = await ReplayExecutionSessionService({
    companyId: input.companyId,
    sessionId: input.sessionId,
    text: input.text
  });

  const session = replay.session;
  const actionExecutions: ActionExecutionReplaySlice[] = [];

  for (const node of session.graph.nodes) {
    const action = mapStepToExecutionAction({
      stepId: node.stepId,
      stepType: node.type,
      objective: node.objective,
      requiresConfirmation: node.requiresConfirmation,
      retryable: node.retryable
    });
    const engine = new ActionExecutionEngine({
      companyId: input.companyId,
      sessionId: session.id
    });
    const { result, events } = await engine.execute(action);
    recordActionExecutionResult(result);
    actionExecutions.push({ action, result, events });
  }

  const fullReplay = {
    ...replay,
    actionExecutions
  };

  const replays = actionReplaysByCompany.get(input.companyId) || [];
  pushCap(replays, {
    id: `actreplay_${createHash("sha256")
      .update(`${session.id}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    sessionId: session.id,
    actions: actionExecutions,
    createdAt: new Date().toISOString()
  });
  actionReplaysByCompany.set(input.companyId, replays);

  return { replay: fullReplay };
}

export async function SimulateActionService(input: {
  companyId: number;
  actionType: string;
  objective?: string;
}) {
  const action = mapStepToExecutionAction({
    stepId: `sim_${Date.now()}`,
    stepType:
      input.actionType === "SEARCH"
        ? "search"
        : input.actionType === "VALIDATE"
          ? "analyze"
          : input.actionType === "TRANSFER"
            ? "transfer"
            : input.actionType === "UPDATE"
              ? "update_entity"
              : input.actionType === "SEND_MESSAGE"
                ? "send_message"
                : input.actionType === "WAIT_CONFIRMATION"
                  ? "confirm"
                  : input.actionType === "WAIT_INPUT"
                    ? "custom"
                    : "custom",
    objective: input.objective || "simulação"
  });
  return ExecuteActionService({
    companyId: input.companyId,
    action
  });
}

export async function InspectStrategyService(input: {
  actionType: string;
}) {
  const action: ExecutionAction = {
    id: "inspect",
    stepId: "inspect",
    actionType: input.actionType as ExecutionAction["actionType"],
    objective: "inspect",
    entities: [],
    constraints: [],
    expectedOutcome: "",
    requiresConfirmation: false,
    retryable: true,
    metadata: {}
  };
  const strategy = defaultStrategyRegistry.resolve(action);
  return {
    strategy: strategy?.name || null,
    actionTypes: strategy?.actionTypes || [],
    usesToolRuntime: false
  };
}

export function __resetActionExecutionAdminForTests(): void {
  actionReplaysByCompany.clear();
}

export default {
  ExecuteActionService,
  ListStrategiesService,
  GetActionExecutionDashboardService
};
