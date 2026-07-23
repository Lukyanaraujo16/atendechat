import { createHash } from "crypto";
import { FeedbackEventName } from "../../../../config/automationExecutionFeedbackConstants";
import { ExecutionSession } from "../execution/executionTypes";
import {
  applyFeedbackRules,
  computeConfidence,
  computeGoalProgress
} from "./FeedbackRules";
import {
  extractFeedbackKnowledge,
  mapRuntimeStatusToStepStatus
} from "./KnowledgeExtraction";
import { updateExecutionSessionFromFeedback } from "./ExecutionSessionUpdater";
import {
  ExecutionFeedback,
  FeedbackEvent,
  FeedbackProcessRecord,
  SessionUpdateResult
} from "./feedbackTypes";
import {
  recordFeedbackEvent,
  recordFeedbackProcess
} from "./ExecutionFeedbackMetrics";

export type FeedbackEngineInput = {
  companyId: number;
  session: ExecutionSession;
  actionId?: string;
  stepId?: string | null;
  runtimeRequestId?: string;
  runtimeResultId?: string;
  runtimeResult?: Record<string, unknown> | null;
  actionResult?: Record<string, unknown> | null;
  entities?: Array<{ key: string; value: string }>;
  constraints?: string[];
  stepRetryable?: boolean;
  stepOptional?: boolean;
  requiresConfirmation?: boolean;
};

function newId(prefix: string, seed: string): string {
  return `${prefix}_${createHash("sha256")
    .update(`${seed}:${Date.now()}`)
    .digest("hex")
    .slice(0, 12)}`;
}

/**
 * ExecutionFeedbackEngine — interpreta Runtime Result → Feedback → Session Update.
 * Nunca executa Tool. Nunca chama Planner.
 */
export class ExecutionFeedbackEngine {
  private emit(
    feedbackId: string,
    name: FeedbackEventName,
    message?: string,
    meta?: Record<string, unknown>
  ): FeedbackEvent {
    const event: FeedbackEvent = {
      id: newId("fevt", `${feedbackId}:${name}`),
      feedbackId,
      name,
      at: new Date().toISOString(),
      message,
      meta
    };
    recordFeedbackEvent(event);
    return event;
  }

  process(input: FeedbackEngineInput): FeedbackProcessRecord {
    const events: FeedbackEvent[] = [];
    const feedbackId = newId("fb", `${input.session.id}:${input.actionId || ""}`);
    const stepId =
      input.stepId ||
      input.session.currentStepId ||
      input.session.pendingSteps[0] ||
      null;

    const node = stepId
      ? input.session.graph.nodes.find(n => n.stepId === stepId)
      : null;

    const runtimeStatus = String(
      input.runtimeResult?.status ||
        (input.actionResult as any)?.status ||
        ""
    );
    const actionStatus = String((input.actionResult as any)?.status || "");
    const validation = String((input.actionResult as any)?.validation || "");

    const stepStatus = mapRuntimeStatusToStepStatus({
      runtimeStatus,
      actionStatus,
      validation
    });

    const knowledge = extractFeedbackKnowledge({
      runtimeResult: input.runtimeResult,
      actionResult: input.actionResult,
      entities: input.entities,
      constraints: input.constraints || []
    });

    // Provisional progress after this step
    let completed = input.session.completedSteps.length;
    let failed = input.session.failedSteps.length;
    let skipped = input.session.skippedSteps.length;
    let pending = input.session.pendingSteps.length;
    let partial = 0;

    const alreadyCounted =
      stepId != null &&
      (input.session.completedSteps.includes(stepId) ||
        input.session.failedSteps.includes(stepId) ||
        input.session.skippedSteps.includes(stepId));

    if (!alreadyCounted && stepId) {
      if (input.session.pendingSteps.includes(stepId)) pending -= 1;
      if (stepStatus === "SUCCESS") completed += 1;
      else if (stepStatus === "PARTIAL") {
        completed += 1;
        partial += 1;
      } else if (stepStatus === "FAILED" || stepStatus === "ABORTED") failed += 1;
      else if (stepStatus === "SKIPPED") skipped += 1;
      else if (stepStatus === "WAITING") {
        // waiting keeps pending conceptually reduced from pending list
      }
    }

    const goalProgress = computeGoalProgress({
      companyId: input.companyId,
      stepsTotal: input.session.metrics.stepsTotal || input.session.graph.nodes.length,
      completedSteps: completed,
      failedSteps: failed,
      pendingSteps: Math.max(0, pending),
      skippedSteps: skipped,
      partialSteps: partial
    });

    const rules = applyFeedbackRules({
      companyId: input.companyId,
      stepStatus,
      stepRetryable: input.stepRetryable ?? node?.retryable ?? true,
      stepOptional: input.stepOptional ?? node?.optional ?? false,
      requiresConfirmation:
        input.requiresConfirmation ?? node?.requiresConfirmation ?? false,
      recoveryAttempts: input.session.recoveryState.attempts,
      runtimeStatus,
      pendingStepsAfter: goalProgress.pendingSteps,
      goalProgress
    });

    const confidence = computeConfidence({
      companyId: input.companyId,
      stepStatus,
      warningCount: knowledge.warnings.length,
      errorCount: knowledge.errors.length
    });

    let executionState = input.session.status as string;
    if (rules.nextDecision === "FINISH") executionState = "COMPLETED";
    else if (rules.nextDecision === "STOP") executionState = "FAILED";
    else if (rules.nextDecision === "WAIT") {
      executionState =
        rules.humanKind === "INPUT"
          ? "WAITING_INPUT"
          : "WAITING_CONFIRMATION";
    } else if (rules.nextDecision === "REPLAN") executionState = "RECOVERING";
    else executionState = "RUNNING";

    const feedback: ExecutionFeedback = {
      feedbackId,
      sessionId: input.session.id,
      actionId: input.actionId || `action_${stepId || "unknown"}`,
      runtimeRequestId: input.runtimeRequestId || "",
      runtimeResultId: input.runtimeResultId || "",
      goalProgress,
      stepStatus,
      executionState,
      recoveryDecision: rules.recoveryDecision,
      nextDecision: rules.nextDecision,
      humanIntervention: {
        required: rules.humanInterventionRequired,
        kind: rules.humanKind,
        reason: rules.humanInterventionRequired
          ? `requires_${rules.humanKind.toLowerCase()}`
          : null
      },
      replanRequired: rules.replanRequired,
      knowledge,
      confidence,
      summary: `step=${stepStatus}; recovery=${rules.recoveryDecision}; next=${rules.nextDecision}; progress=${goalProgress.completionPercentage}%`,
      metadata: {
        executesTools: false,
        callsPlanner: false,
        usesProvider: false,
        stepId,
        runtimeStatus,
        deterministic: true
      }
    };

    events.push(
      this.emit(feedbackId, "FEEDBACK_CREATED", feedback.summary, {
        stepStatus,
        nextDecision: rules.nextDecision
      })
    );
    events.push(
      this.emit(feedbackId, "GOAL_PROGRESS_UPDATED", undefined, {
        completionPercentage: goalProgress.completionPercentage,
        goalAchieved: goalProgress.goalAchieved
      })
    );

    if (rules.recoveryDecision !== "NONE") {
      events.push(
        this.emit(feedbackId, "RECOVERY_REQUESTED", rules.recoveryDecision)
      );
    }
    if (rules.replanRequired) {
      events.push(this.emit(feedbackId, "REPLAN_REQUESTED", "replan"));
    }
    if (rules.humanInterventionRequired) {
      events.push(
        this.emit(
          feedbackId,
          "HUMAN_INTERVENTION_REQUESTED",
          rules.humanKind
        )
      );
    }

    const { session: updatedSession, update } =
      updateExecutionSessionFromFeedback({
        session: input.session,
        feedback,
        stepId
      });

    events.push(
      this.emit(feedbackId, "SESSION_UPDATED", update.nextStatus, {
        previousStatus: update.previousStatus,
        currentStepId: update.currentStepId
      })
    );

    const record: FeedbackProcessRecord = {
      id: feedbackId,
      companyId: input.companyId,
      feedback,
      sessionUpdate: update,
      events,
      createdAt: new Date().toISOString()
    };
    // stash updated session for callers that need it
    (record as any).updatedSession = updatedSession;
    recordFeedbackProcess(record);
    return record;
  }
}

export default ExecutionFeedbackEngine;
