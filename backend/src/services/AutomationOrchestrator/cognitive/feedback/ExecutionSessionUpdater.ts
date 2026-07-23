import { createHash } from "crypto";
import { FeedbackStepStatus } from "../../../../config/automationExecutionFeedbackConstants";
import { ExecutionSession } from "../execution/executionTypes";
import { ExecutionFeedback, SessionUpdateResult } from "./feedbackTypes";

function cloneSession(session: ExecutionSession): ExecutionSession {
  return JSON.parse(JSON.stringify(session));
}

function nextStepFromPending(session: ExecutionSession): string | null {
  return session.pendingSteps[0] || null;
}

/**
 * ExecutionSessionUpdater — atualiza sessão a partir do Feedback.
 * Não executa Tools. Não chama Planner. Não altera Orchestrator source.
 */
export function updateExecutionSessionFromFeedback(input: {
  session: ExecutionSession;
  feedback: ExecutionFeedback;
  stepId?: string | null;
}): { session: ExecutionSession; update: SessionUpdateResult } {
  const session = cloneSession(input.session);
  const previousStatus = session.status;
  const stepId =
    input.stepId ||
    session.currentStepId ||
    (session.pendingSteps[0] ?? null);
  const now = new Date().toISOString();

  const removeFrom = (arr: string[], id: string | null) => {
    if (!id) return;
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
  };

  if (stepId) {
    removeFrom(session.pendingSteps, stepId);
    removeFrom(session.waitingSteps, stepId);
    removeFrom(session.completedSteps, stepId);
    removeFrom(session.failedSteps, stepId);
    removeFrom(session.skippedSteps, stepId);

    switch (input.feedback.stepStatus as FeedbackStepStatus) {
      case "SUCCESS":
      case "PARTIAL":
        session.completedSteps.push(stepId);
        session.metrics.stepsCompleted = session.completedSteps.length;
        break;
      case "FAILED":
        session.failedSteps.push(stepId);
        session.metrics.stepsFailed = session.failedSteps.length;
        break;
      case "SKIPPED":
        session.skippedSteps.push(stepId);
        session.metrics.stepsSkipped = session.skippedSteps.length;
        break;
      case "WAITING":
        if (!session.waitingSteps.includes(stepId)) {
          session.waitingSteps.push(stepId);
        }
        session.metrics.waitingCount = session.waitingSteps.length;
        break;
      case "ABORTED":
        session.failedSteps.push(stepId);
        session.metrics.stepsFailed = session.failedSteps.length;
        break;
      default:
        break;
    }
  }

  if (input.feedback.recoveryDecision !== "NONE") {
    session.recoveryState.active = true;
    session.recoveryState.lastAction = input.feedback.recoveryDecision;
    session.recoveryState.attempts += 1;
    session.recoveryState.history.push({
      stepId: stepId || "unknown",
      action: input.feedback.recoveryDecision,
      at: now
    });
    session.metrics.recoveries = session.recoveryState.history.length;
  }

  if (input.feedback.nextDecision === "FINISH") {
    session.status = "COMPLETED";
    session.currentStepId = null;
    session.timestamps.completedAt = now;
  } else if (input.feedback.nextDecision === "STOP") {
    session.status = "FAILED";
    session.timestamps.failedAt = now;
  } else if (input.feedback.nextDecision === "WAIT") {
    session.status =
      input.feedback.humanIntervention.kind === "INPUT"
        ? "WAITING_INPUT"
        : "WAITING_CONFIRMATION";
    session.currentStepId = stepId;
  } else if (input.feedback.nextDecision === "REPLAN") {
    session.status = "RECOVERING";
    session.currentStepId = stepId;
  } else {
    // CONTINUE
    if (input.feedback.recoveryDecision === "RETRY") {
      session.status = "RUNNING";
      session.currentStepId = stepId;
      session.metrics.retries += 1;
      if (stepId && !session.pendingSteps.includes(stepId)) {
        session.pendingSteps.unshift(stepId);
      }
    } else if (input.feedback.recoveryDecision === "SKIP") {
      session.status = "RUNNING";
      session.currentStepId = nextStepFromPending(session);
    } else {
      session.status = "RUNNING";
      session.currentStepId = nextStepFromPending(session);
    }
  }

  session.timestamps.updatedAt = now;
  session.events.push({
    id: `fevt_${createHash("sha256")
      .update(`${session.id}:${input.feedback.feedbackId}`)
      .digest("hex")
      .slice(0, 12)}`,
    sessionId: session.id,
    kind: "step",
    name: "FEEDBACK_APPLIED",
    stepId,
    message: input.feedback.summary,
    at: now,
    meta: {
      feedbackId: input.feedback.feedbackId,
      stepStatus: input.feedback.stepStatus,
      nextDecision: input.feedback.nextDecision,
      recoveryDecision: input.feedback.recoveryDecision
    }
  });

  if (!Array.isArray(session.metadata.feedbackHistory)) {
    session.metadata.feedbackHistory = [];
  }
  (session.metadata.feedbackHistory as Array<Record<string, unknown>>).push({
    feedbackId: input.feedback.feedbackId,
    stepId,
    stepStatus: input.feedback.stepStatus,
    at: now
  });

  const update: SessionUpdateResult = {
    sessionId: session.id,
    previousStatus,
    nextStatus: session.status,
    currentStepId: session.currentStepId,
    completedSteps: [...session.completedSteps],
    failedSteps: [...session.failedSteps],
    pendingSteps: [...session.pendingSteps],
    waitingSteps: [...session.waitingSteps],
    metrics: {
      stepsTotal: session.metrics.stepsTotal,
      stepsCompleted: session.metrics.stepsCompleted,
      stepsFailed: session.metrics.stepsFailed,
      stepsSkipped: session.metrics.stepsSkipped,
      retries: session.metrics.retries,
      waitingCount: session.metrics.waitingCount,
      recoveries: session.metrics.recoveries
    },
    timelineAppended: 1,
    historyEntry: {
      feedbackId: input.feedback.feedbackId,
      stepId,
      stepStatus: input.feedback.stepStatus,
      at: now
    }
  };

  return { session, update };
}

export default { updateExecutionSessionFromFeedback };
