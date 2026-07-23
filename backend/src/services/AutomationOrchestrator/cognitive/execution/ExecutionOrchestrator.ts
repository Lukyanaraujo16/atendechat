import { createHash } from "crypto";
import {
  AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION,
  ExecutionSessionStatus,
  SessionEventName,
  StepEventName
} from "../../../../config/automationExecutionOrchestratorConstants";
import { ExecutionPlan, Goal, RecoveryPlan } from "../types";
import { PlanEvaluationReport } from "../evaluation/evaluationTypes";
import { buildExecutionGraph } from "./ExecutionGraphBuilder";
import { validateTransition } from "./StateValidator";
import { resolveNextSteps } from "./NextStepResolver";
import { decideRecoveryAction } from "./RecoveryOrchestration";
import { getExecutionOrchestratorConfig } from "./ExecutionOrchestratorConfig";
import {
  ExecutionCheckpoint,
  ExecutionEvent,
  ExecutionSession,
  NextStepDecision,
  RecoveryDecision
} from "./executionTypes";
import {
  recordSessionCreated,
  recordSessionCompleted,
  recordSessionFailed,
  recordSessionMetricBump
} from "./ExecutionOrchestratorMetrics";

function eventId(sessionId: string, name: string): string {
  return createHash("sha256")
    .update(`${sessionId}:${name}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 14);
}

function pushEvent(
  session: ExecutionSession,
  kind: "session" | "step",
  name: SessionEventName | StepEventName | string,
  extra?: { stepId?: string | null; message?: string; meta?: Record<string, unknown> }
): void {
  const ev: ExecutionEvent = {
    id: `ev_${eventId(session.id, name)}`,
    sessionId: session.id,
    kind,
    name,
    stepId: extra?.stepId ?? null,
    message: extra?.message,
    at: new Date().toISOString(),
    meta: extra?.meta
  };
  session.events.unshift(ev);
  if (session.events.length > 500) session.events.length = 500;
}

function applyStatus(
  session: ExecutionSession,
  to: ExecutionSessionStatus
): { ok: boolean; reason: string } {
  const check = validateTransition(session.status, to);
  if (!check.allowed) {
    pushEvent(session, "session", "TRANSITION_REJECTED", {
      message: check.reason,
      meta: { from: check.from, to: check.to }
    });
    return { ok: false, reason: check.reason };
  }
  const now = new Date().toISOString();
  session.status = to;
  session.timestamps.updatedAt = now;
  if (to === "READY") session.timestamps.readyAt = now;
  if (to === "RUNNING" && !session.timestamps.startedAt) {
    session.timestamps.startedAt = now;
  }
  if (to === "PAUSED") session.timestamps.pausedAt = now;
  if (to === "RUNNING" && session.timestamps.pausedAt) {
    session.timestamps.resumedAt = now;
  }
  if (to === "COMPLETED") {
    session.timestamps.completedAt = now;
    session.metrics.durationMs = Math.max(
      0,
      Date.now() - new Date(session.timestamps.createdAt).getTime()
    );
  }
  if (to === "FAILED") session.timestamps.failedAt = now;
  if (to === "ABORTED") session.timestamps.abortedAt = now;
  return { ok: true, reason: "ok" };
}

function maybeCheckpoint(
  session: ExecutionSession,
  stepId: string | null,
  companyId: number
): void {
  const cfg = getExecutionOrchestratorConfig(companyId);
  if (!cfg.autoCheckpoint) return;
  const node = stepId
    ? session.graph.nodes.find(n => n.stepId === stepId)
    : null;
  if (stepId && node && !node.checkpoint) return;
  const cp: ExecutionCheckpoint = {
    id: `cp_${eventId(session.id, stepId || "root")}`,
    sessionId: session.id,
    stepId,
    kind: stepId ? "checkpoint" : "snapshot",
    label: stepId ? `after_${stepId}` : "session_snapshot",
    createdAt: new Date().toISOString(),
    snapshot: {
      status: session.status,
      currentStepId: session.currentStepId,
      completedSteps: [...session.completedSteps],
      failedSteps: [...session.failedSteps],
      skippedSteps: [...session.skippedSteps]
    }
  };
  session.checkpoints.unshift(cp);
  if (session.checkpoints.length > 100) session.checkpoints.length = 100;
}

/**
 * ExecutionOrchestrator — controla vida da sessão.
 * NÃO executa Tools / Providers / Runtime.
 */
export function openExecutionSession(input: {
  companyId: number;
  goal: Goal;
  plan: ExecutionPlan;
  evaluation?: PlanEvaluationReport | null;
}): ExecutionSession {
  const cfg = getExecutionOrchestratorConfig(input.companyId);
  if (input.plan.steps.length > cfg.maxStepsPerSession) {
    throw new Error(
      `max_steps_exceeded:${input.plan.steps.length}>${cfg.maxStepsPerSession}`
    );
  }

  const graph = buildExecutionGraph(input.plan);
  const id = createHash("sha256")
    .update(
      `${input.companyId}:${input.goal.id}:${input.plan.id}:${Date.now()}`
    )
    .digest("hex")
    .slice(0, 20);

  const now = new Date().toISOString();
  const session: ExecutionSession = {
    id: `sess_${id}`,
    companyId: input.companyId,
    goalId: input.goal.id,
    planId: input.plan.id,
    evaluationId: input.evaluation?.id || null,
    status: "CREATED",
    currentStepId: null,
    completedSteps: [],
    failedSteps: [],
    skippedSteps: [],
    pendingSteps: graph.order.slice(),
    waitingSteps: [],
    executionContext: {
      executesTools: false,
      knowsProviders: false,
      knowsToolRuntime: false
    },
    validationState: {
      evaluationApproval: input.evaluation?.approval || null,
      evaluationScore: input.evaluation?.score ?? null
    },
    recoveryState: {
      active: false,
      lastAction: null,
      attempts: 0,
      history: []
    },
    graph,
    checkpoints: [],
    events: [],
    timestamps: {
      createdAt: now,
      updatedAt: now
    },
    metrics: {
      stepsTotal: graph.nodes.length,
      stepsCompleted: 0,
      stepsFailed: 0,
      stepsSkipped: 0,
      retries: 0,
      pauses: 0,
      waitingCount: 0,
      recoveries: 0,
      durationMs: 0
    },
    metadata: {
      version: AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION,
      goalType: input.goal.type,
      planVersion: input.plan.version,
      executesTools: false
    },
    version: AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION
  };

  pushEvent(session, "session", "SESSION_CREATED", {
    message: "session_opened"
  });
  applyStatus(session, "READY");
  pushEvent(session, "session", "SESSION_READY", { message: "ready" });
  maybeCheckpoint(session, null, input.companyId);
  recordSessionCreated(input.companyId);
  return session;
}

export function startExecutionSession(
  session: ExecutionSession
): { session: ExecutionSession; next: NextStepDecision } {
  const r = applyStatus(session, "RUNNING");
  if (!r.ok) {
    return { session, next: resolveNextSteps(session) };
  }
  pushEvent(session, "session", "SESSION_STARTED");
  const next = resolveNextSteps(session);
  session.currentStepId = next.nextStepId;
  if (next.nextStepId) {
    pushEvent(session, "step", "STEP_STARTED", { stepId: next.nextStepId });
    if (next.waitingConfirmation.includes(next.nextStepId)) {
      session.waitingSteps.push(next.nextStepId);
      session.metrics.waitingCount += 1;
      applyStatus(session, "WAITING_CONFIRMATION");
      pushEvent(session, "step", "STEP_WAITING", {
        stepId: next.nextStepId,
        message: "confirmation_required"
      });
      recordSessionMetricBump(session.companyId, "waiting");
    }
  }
  return { session, next };
}

export function pauseExecutionSession(
  session: ExecutionSession
): ExecutionSession {
  const cfg = getExecutionOrchestratorConfig(session.companyId);
  if (session.metrics.pauses >= cfg.maxPauses) {
    pushEvent(session, "session", "PAUSE_REJECTED", {
      message: "max_pauses"
    });
    return session;
  }
  const r = applyStatus(session, "PAUSED");
  if (r.ok) {
    session.metrics.pauses += 1;
    pushEvent(session, "session", "SESSION_PAUSED");
    recordSessionMetricBump(session.companyId, "pause");
  }
  return session;
}

export function resumeExecutionSession(
  session: ExecutionSession
): { session: ExecutionSession; next: NextStepDecision } {
  const r = applyStatus(session, "RUNNING");
  if (r.ok) {
    pushEvent(session, "session", "SESSION_RESUMED");
  }
  return { session, next: resolveNextSteps(session) };
}

export function abortExecutionSession(
  session: ExecutionSession
): ExecutionSession {
  const r = applyStatus(session, "ABORTED");
  if (r.ok) {
    if (session.currentStepId) {
      pushEvent(session, "step", "STEP_ABORTED", {
        stepId: session.currentStepId
      });
    }
    pushEvent(session, "session", "SESSION_ABORTED");
    recordSessionFailed(session.companyId, "aborted");
  }
  return session;
}

/**
 * Avança um passo simulado (sem Tool).
 * action: complete | fail | skip | confirm | input
 */
export function advanceExecutionStep(input: {
  session: ExecutionSession;
  action: "complete" | "fail" | "skip" | "confirm" | "input";
  stepId?: string;
  recoveryPlan?: RecoveryPlan | null;
}): {
  session: ExecutionSession;
  next: NextStepDecision;
  recovery?: RecoveryDecision;
} {
  const session = input.session;
  if (
    session.status !== "RUNNING" &&
    session.status !== "WAITING_CONFIRMATION" &&
    session.status !== "WAITING_INPUT" &&
    session.status !== "RECOVERING"
  ) {
    return { session, next: resolveNextSteps(session) };
  }

  const nextBefore = resolveNextSteps(session);
  const stepId =
    input.stepId ||
    session.currentStepId ||
    nextBefore.nextStepId ||
    nextBefore.waitingConfirmation[0];

  if (!stepId) {
    applyStatus(session, "COMPLETED");
    pushEvent(session, "session", "SESSION_COMPLETED");
    recordSessionCompleted(session.companyId, session);
    return { session, next: resolveNextSteps(session) };
  }

  if (input.action === "confirm" || input.action === "input") {
    session.executionContext[`confirmed:${stepId}`] = true;
    session.waitingSteps = session.waitingSteps.filter(s => s !== stepId);
    if (session.status === "WAITING_CONFIRMATION" || session.status === "WAITING_INPUT") {
      applyStatus(session, "RUNNING");
    }
    pushEvent(session, "step", "STEP_STARTED", {
      stepId,
      message: input.action === "confirm" ? "confirmed" : "input_received"
    });
    session.currentStepId = stepId;
    return { session, next: resolveNextSteps(session) };
  }

  if (input.action === "skip") {
    session.skippedSteps.push(stepId);
    session.pendingSteps = session.pendingSteps.filter(s => s !== stepId);
    session.waitingSteps = session.waitingSteps.filter(s => s !== stepId);
    session.metrics.stepsSkipped += 1;
    pushEvent(session, "step", "STEP_SKIPPED", { stepId });
    maybeCheckpoint(session, stepId, session.companyId);
  } else if (input.action === "complete") {
    session.completedSteps.push(stepId);
    session.pendingSteps = session.pendingSteps.filter(s => s !== stepId);
    session.waitingSteps = session.waitingSteps.filter(s => s !== stepId);
    session.metrics.stepsCompleted += 1;
    pushEvent(session, "step", "STEP_COMPLETED", { stepId });
    maybeCheckpoint(session, stepId, session.companyId);
  } else if (input.action === "fail") {
    session.failedSteps.push(stepId);
    session.pendingSteps = session.pendingSteps.filter(s => s !== stepId);
    session.metrics.stepsFailed += 1;
    pushEvent(session, "step", "STEP_FAILED", { stepId });
    applyStatus(session, "RECOVERING");
    session.recoveryState.active = true;
    session.metrics.recoveries += 1;
    recordSessionMetricBump(session.companyId, "recovery");

    const recovery = decideRecoveryAction({
      session,
      recoveryPlan: input.recoveryPlan,
      stepId
    });
    session.recoveryState.lastAction = recovery.action;
    session.recoveryState.attempts += 1;
    session.recoveryState.history.push({
      stepId,
      action: recovery.action,
      at: new Date().toISOString()
    });

    if (recovery.action === "RETRY") {
      session.failedSteps = session.failedSteps.filter(s => s !== stepId);
      session.pendingSteps.push(stepId);
      session.metrics.retries += 1;
      pushEvent(session, "step", "STEP_RETRY", { stepId });
      applyStatus(session, "RUNNING");
      session.recoveryState.active = false;
    } else if (recovery.action === "SKIP") {
      session.failedSteps = session.failedSteps.filter(s => s !== stepId);
      session.skippedSteps.push(stepId);
      session.metrics.stepsSkipped += 1;
      pushEvent(session, "step", "STEP_SKIPPED", {
        stepId,
        message: "recovery_skip"
      });
      applyStatus(session, "RUNNING");
      session.recoveryState.active = false;
    } else if (recovery.action === "ASK_CONFIRMATION") {
      session.waitingSteps.push(stepId);
      applyStatus(session, "WAITING_CONFIRMATION");
      pushEvent(session, "step", "STEP_WAITING", { stepId });
    } else if (recovery.action === "REPLAN") {
      applyStatus(session, "FAILED");
      pushEvent(session, "session", "SESSION_FAILED", {
        message: "replan_required"
      });
      recordSessionFailed(session.companyId, "replan");
    } else {
      applyStatus(session, "FAILED");
      pushEvent(session, "session", "SESSION_FAILED", {
        message: recovery.reason
      });
      recordSessionFailed(session.companyId, "abort_recovery");
    }

    const next = resolveNextSteps(session);
    session.currentStepId = next.nextStepId;
    return { session, next, recovery };
  }

  // complete/skip path — advance
  if (session.status === "RECOVERING") {
    applyStatus(session, "RUNNING");
    session.recoveryState.active = false;
  } else if (
    session.status === "WAITING_CONFIRMATION" ||
    session.status === "WAITING_INPUT"
  ) {
    applyStatus(session, "RUNNING");
  }

  const next = resolveNextSteps(session);
  session.currentStepId = next.nextStepId;

  if (
    !next.nextStepId &&
    !next.waitingConfirmation.length &&
    !next.waitingRecovery.length &&
    session.failedSteps.length === 0
  ) {
    applyStatus(session, "COMPLETED");
    pushEvent(session, "session", "SESSION_COMPLETED");
    recordSessionCompleted(session.companyId, session);
  } else if (next.waitingConfirmation.length && next.nextStepId == null) {
    const waitId = next.waitingConfirmation[0];
    session.currentStepId = waitId;
    if (!session.waitingSteps.includes(waitId)) {
      session.waitingSteps.push(waitId);
    }
    applyStatus(session, "WAITING_CONFIRMATION");
    pushEvent(session, "step", "STEP_WAITING", { stepId: waitId });
  } else if (next.nextStepId) {
    pushEvent(session, "step", "STEP_STARTED", { stepId: next.nextStepId });
  }

  return { session, next };
}

export default {
  openExecutionSession,
  startExecutionSession,
  pauseExecutionSession,
  resumeExecutionSession,
  abortExecutionSession,
  advanceExecutionStep
};
