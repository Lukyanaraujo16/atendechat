import { AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION } from "../../../../config/automationExecutionOrchestratorConstants";
import { analyzeGoal } from "../GoalAnalyzer";
import { planFromGoal } from "../CognitivePlanner";
import { evaluatePlan } from "../evaluation/PlanEvaluationEngine";
import {
  openExecutionSession,
  startExecutionSession,
  pauseExecutionSession,
  resumeExecutionSession,
  abortExecutionSession,
  advanceExecutionStep
} from "./ExecutionOrchestrator";
import { buildExecutionGraph } from "./ExecutionGraphBuilder";
import { resolveNextSteps } from "./NextStepResolver";
import { validateTransition, listAllowedTransitions } from "./StateValidator";
import { decideRecoveryAction } from "./RecoveryOrchestration";
import {
  getExecutionOrchestratorConfig,
  setExecutionOrchestratorConfig
} from "./ExecutionOrchestratorConfig";
import { getExecutionOrchestratorMetrics } from "./ExecutionOrchestratorMetrics";
import {
  ExecutionReplayRecord,
  ExecutionSession
} from "./executionTypes";
import { createHash } from "crypto";
import { suggestRecovery } from "../RecoveryEngine";
import { validateStep } from "../ValidationEngine";

const MAX = 200;
const sessionsByCompany = new Map<number, ExecutionSession[]>();
const replaysByCompany = new Map<number, ExecutionReplayRecord[]>();

function list(companyId: number): ExecutionSession[] {
  let arr = sessionsByCompany.get(companyId);
  if (!arr) {
    arr = [];
    sessionsByCompany.set(companyId, arr);
  }
  return arr;
}

function pushCap<T>(arr: T[], item: T): void {
  arr.unshift(item);
  if (arr.length > MAX) arr.length = MAX;
}

function save(session: ExecutionSession): void {
  const arr = list(session.companyId);
  const idx = arr.findIndex(s => s.id === session.id);
  if (idx >= 0) arr[idx] = session;
  else pushCap(arr, session);
}

function find(companyId: number, id: string): ExecutionSession | null {
  return list(companyId).find(s => s.id === id) || null;
}

export async function GetExecutionSessionsDashboardService(input: {
  companyId: number;
}) {
  const sessions = list(input.companyId);
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    counts[s.status] = (counts[s.status] || 0) + 1;
  }
  return {
    version: AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION,
    metrics: getExecutionOrchestratorMetrics(input.companyId),
    config: getExecutionOrchestratorConfig(input.companyId),
    counts: {
      running: counts.RUNNING || 0,
      paused: counts.PAUSED || 0,
      recovering: counts.RECOVERING || 0,
      completed: counts.COMPLETED || 0,
      failed: counts.FAILED || 0,
      waitingConfirmation: counts.WAITING_CONFIRMATION || 0,
      waitingInput: counts.WAITING_INPUT || 0,
      ready: counts.READY || 0,
      created: counts.CREATED || 0,
      aborted: counts.ABORTED || 0
    },
    recentSessions: sessions.slice(0, 20),
    guarantees: {
      executesTools: false,
      knowsProviders: false,
      knowsToolRuntime: false,
      liveUnchanged: true,
      shadowUnchanged: true
    }
  };
}

export async function CreateExecutionSessionService(input: {
  companyId: number;
  text?: string;
  goal?: any;
  plan?: any;
  evaluation?: any;
}) {
  const goal =
    input.goal ||
    analyzeGoal({
      text: input.text || "",
      companyId: input.companyId
    });
  const plan = input.plan || planFromGoal(goal);
  const evaluation =
    input.evaluation ||
    evaluatePlan({ plan, goal, companyId: input.companyId });
  const session = openExecutionSession({
    companyId: input.companyId,
    goal,
    plan,
    evaluation
  });
  save(session);
  return { goal, plan, evaluation, session };
}

export async function StartExecutionSessionService(input: {
  companyId: number;
  sessionId: string;
}) {
  const session = find(input.companyId, input.sessionId);
  if (!session) return { session: null, error: "not_found" };
  const result = startExecutionSession(session);
  save(result.session);
  return result;
}

export async function PauseExecutionSessionService(input: {
  companyId: number;
  sessionId: string;
}) {
  const session = find(input.companyId, input.sessionId);
  if (!session) return { session: null, error: "not_found" };
  const updated = pauseExecutionSession(session);
  save(updated);
  return { session: updated };
}

export async function ResumeExecutionSessionService(input: {
  companyId: number;
  sessionId: string;
}) {
  const session = find(input.companyId, input.sessionId);
  if (!session) return { session: null, error: "not_found" };
  const result = resumeExecutionSession(session);
  save(result.session);
  return result;
}

export async function AbortExecutionSessionService(input: {
  companyId: number;
  sessionId: string;
}) {
  const session = find(input.companyId, input.sessionId);
  if (!session) return { session: null, error: "not_found" };
  const updated = abortExecutionSession(session);
  save(updated);
  return { session: updated };
}

export async function AdvanceExecutionSessionService(input: {
  companyId: number;
  sessionId: string;
  action: "complete" | "fail" | "skip" | "confirm" | "input";
  stepId?: string;
}) {
  const session = find(input.companyId, input.sessionId);
  if (!session) return { session: null, error: "not_found" };
  let recoveryPlan = null;
  if (input.action === "fail" && (input.stepId || session.currentStepId)) {
    const stepId = input.stepId || session.currentStepId!;
    const node = session.graph.nodes.find(n => n.stepId === stepId);
    if (node) {
      const stepLike = {
        id: node.stepId,
        type: node.type as any,
        objective: node.objective,
        expectedResult: "",
        requiredEntities: [],
        dependsOn: node.dependencies,
        optional: node.optional,
        retryable: node.retryable,
        requiresConfirmation: node.requiresConfirmation,
        status: "pending" as const
      };
      const validation = validateStep({
        step: stepLike,
        simulatedOutcome: { success: false, note: "simulated_fail" }
      });
      recoveryPlan = suggestRecovery({
        plan: {
          id: session.planId,
          goalId: session.goalId,
          version: session.version,
          steps: [stepLike],
          dependencies: [],
          preConditions: [],
          postConditions: [],
          estimatedComplexity: 1,
          estimatedRisk: "medium",
          estimatedToolCalls: 0,
          estimatedCost: 0,
          estimatedLatency: 0,
          status: "ready",
          createdAt: new Date().toISOString()
        },
        step: stepLike,
        validation
      });
    }
  }
  const result = advanceExecutionStep({
    session,
    action: input.action,
    stepId: input.stepId,
    recoveryPlan
  });
  save(result.session);
  return result;
}

export async function ListExecutionSessionsService(input: {
  companyId: number;
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, input.limit || 20));
  return {
    version: AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION,
    records: list(input.companyId).slice(0, limit)
  };
}

export async function GetExecutionSessionService(input: {
  companyId: number;
  id: string;
}) {
  const session = find(input.companyId, input.id);
  if (!session) return { session: null };
  return {
    session,
    next: resolveNextSteps(session),
    allowedTransitions: listAllowedTransitions(session.status)
  };
}

export async function ReplayExecutionSessionService(input: {
  companyId: number;
  sessionId?: string;
  text?: string;
}) {
  let session = input.sessionId
    ? find(input.companyId, input.sessionId)
    : null;
  let goal: any;
  let plan: any;
  let evaluation: any;

  if (!session) {
    const created = await CreateExecutionSessionService({
      companyId: input.companyId,
      text: input.text || "como funciona o produto?"
    });
    goal = created.goal;
    plan = created.plan;
    evaluation = created.evaluation;
    session = created.session;
    startExecutionSession(session);
    // simulate full happy path without tools
    let guard = 0;
    while (
      session.status === "RUNNING" ||
      session.status === "WAITING_CONFIRMATION" ||
      session.status === "READY"
    ) {
      if (guard++ > 40) break;
      if (session.status === "READY") {
        startExecutionSession(session);
        continue;
      }
      const next = resolveNextSteps(session);
      if (next.waitingConfirmation.length) {
        advanceExecutionStep({
          session,
          action: "confirm",
          stepId: next.waitingConfirmation[0]
        });
        advanceExecutionStep({
          session,
          action: "complete",
          stepId: next.waitingConfirmation[0]
        });
      } else if (next.nextStepId) {
        advanceExecutionStep({
          session,
          action: "complete",
          stepId: next.nextStepId
        });
      } else {
        break;
      }
    }
    save(session);
  } else {
    goal = { id: session.goalId };
    plan = { id: session.planId };
    evaluation = session.evaluationId
      ? { id: session.evaluationId }
      : null;
  }

  const replay: ExecutionReplayRecord = {
    id: `exreplay_${createHash("sha256")
      .update(`${session.id}:${Date.now()}`)
      .digest("hex")
      .slice(0, 16)}`,
    companyId: input.companyId,
    sessionId: session.id,
    goal,
    plan,
    evaluation,
    session,
    stepTimeline: session.events.filter(e => e.kind === "step"),
    recovery: session.recoveryState,
    finalState: session.status,
    createdAt: new Date().toISOString()
  };
  const replays = replaysByCompany.get(input.companyId) || [];
  pushCap(replays, replay);
  replaysByCompany.set(input.companyId, replays);
  return { replay };
}

export async function SimulateTransitionService(input: {
  from: string;
  to: string;
}) {
  return validateTransition(input.from as any, input.to as any);
}

export async function InspectGraphService(input: {
  companyId: number;
  text?: string;
  sessionId?: string;
}) {
  if (input.sessionId) {
    const session = find(input.companyId, input.sessionId);
    if (session) {
      return {
        graph: session.graph,
        next: resolveNextSteps(session),
        status: session.status
      };
    }
  }
  const goal = analyzeGoal({
    text: input.text || "transferir para atendente",
    companyId: input.companyId
  });
  const plan = planFromGoal(goal);
  const graph = buildExecutionGraph(plan);
  return { goal, plan, graph };
}

export async function UpsertExecutionOrchestratorConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  return {
    config: setExecutionOrchestratorConfig(input.companyId, input.config)
  };
}

export async function GetExecutionOrchestratorConfigService(input: {
  companyId: number;
}) {
  return { config: getExecutionOrchestratorConfig(input.companyId) };
}

export async function SimulateRecoveryService(input: {
  companyId: number;
  sessionId?: string;
  text?: string;
  stepId?: string;
}) {
  let session = input.sessionId
    ? find(input.companyId, input.sessionId)
    : null;
  if (!session) {
    const created = await CreateExecutionSessionService({
      companyId: input.companyId,
      text: input.text || "enviar mensagem"
    });
    session = created.session;
    startExecutionSession(session);
  }
  const stepId =
    input.stepId ||
    session.currentStepId ||
    session.graph.order[0];
  const decision = decideRecoveryAction({ session, stepId });
  return { session, decision };
}

export function __resetExecutionSessionsForTests(): void {
  sessionsByCompany.clear();
  replaysByCompany.clear();
}

export default {
  CreateExecutionSessionService,
  GetExecutionSessionsDashboardService
};
