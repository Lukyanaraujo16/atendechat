import {
  FeedbackNextDecision,
  FeedbackRecoveryDecision,
  FeedbackStepStatus
} from "../../../../config/automationExecutionFeedbackConstants";
import { getExecutionFeedbackConfig } from "./ExecutionFeedbackConfig";
import { GoalProgress } from "./feedbackTypes";

export type FeedbackRulesInput = {
  companyId: number;
  stepStatus: FeedbackStepStatus;
  stepRetryable?: boolean;
  stepOptional?: boolean;
  requiresConfirmation?: boolean;
  recoveryAttempts?: number;
  runtimeStatus?: string;
  pendingStepsAfter?: number;
  goalProgress: GoalProgress;
};

/**
 * Feedback Rules — mecanismo determinístico configurável.
 * Sem IA / Provider.
 */
export function applyFeedbackRules(input: FeedbackRulesInput): {
  recoveryDecision: FeedbackRecoveryDecision;
  nextDecision: FeedbackNextDecision;
  replanRequired: boolean;
  humanInterventionRequired: boolean;
  humanKind: "NONE" | "CONFIRMATION" | "INPUT" | "MANUAL_REVIEW";
} {
  const config = getExecutionFeedbackConfig(input.companyId);
  const rules = config.recoveryRules;
  const attempts = input.recoveryAttempts || 0;

  let recoveryDecision: FeedbackRecoveryDecision = "NONE";
  let nextDecision: FeedbackNextDecision = "CONTINUE";
  let replanRequired = false;
  let humanInterventionRequired = false;
  let humanKind: "NONE" | "CONFIRMATION" | "INPUT" | "MANUAL_REVIEW" = "NONE";

  const runtimeStatus = String(input.runtimeStatus || "").toLowerCase();

  if (input.stepStatus === "SUCCESS") {
    recoveryDecision = "NONE";
    nextDecision =
      input.goalProgress.goalAchieved || (input.pendingStepsAfter || 0) === 0
        ? "FINISH"
        : "CONTINUE";
  } else if (input.stepStatus === "WAITING") {
    if (input.requiresConfirmation || runtimeStatus === "waiting") {
      recoveryDecision = rules.onWaitingConfirmation;
      humanKind = "CONFIRMATION";
    } else {
      recoveryDecision = rules.onWaitingInput;
      humanKind = "INPUT";
    }
    nextDecision = "WAIT";
    humanInterventionRequired = true;
  } else if (input.stepStatus === "PARTIAL") {
    if (runtimeStatus === "denied") {
      recoveryDecision = rules.onDenied;
      replanRequired = recoveryDecision === "REPLAN";
      nextDecision = replanRequired ? "REPLAN" : "CONTINUE";
    } else {
      recoveryDecision = "NONE";
      nextDecision =
        (input.pendingStepsAfter || 0) === 0 ? "FINISH" : "CONTINUE";
    }
  } else if (input.stepStatus === "SKIPPED") {
    recoveryDecision = "NONE";
    nextDecision =
      input.goalProgress.goalAchieved || (input.pendingStepsAfter || 0) === 0
        ? "FINISH"
        : "CONTINUE";
  } else if (input.stepStatus === "ABORTED") {
    recoveryDecision = "ABORT";
    nextDecision = "STOP";
  } else {
    // FAILED
    if (runtimeStatus === "timeout") {
      recoveryDecision =
        attempts < rules.maxRecoveryAttempts
          ? rules.onTimeout
          : rules.onFailureNonRecoverable;
    } else if (input.stepRetryable && attempts < rules.maxRecoveryAttempts) {
      recoveryDecision = rules.onFailureRetryable;
    } else if (input.stepOptional) {
      recoveryDecision = rules.onFailureOptional;
    } else {
      recoveryDecision = rules.onFailureNonRecoverable;
    }

    if (recoveryDecision === "RETRY") nextDecision = "CONTINUE";
    else if (recoveryDecision === "SKIP") nextDecision = "CONTINUE";
    else if (recoveryDecision === "REPLAN") {
      replanRequired = true;
      nextDecision = "REPLAN";
    } else if (recoveryDecision === "ASK_CONFIRMATION") {
      humanInterventionRequired = true;
      humanKind = "CONFIRMATION";
      nextDecision = "WAIT";
    } else if (recoveryDecision === "ASK_INPUT") {
      humanInterventionRequired = true;
      humanKind = "INPUT";
      nextDecision = "WAIT";
    } else {
      nextDecision = "STOP";
    }
  }

  if (recoveryDecision === "REPLAN") {
    replanRequired = true;
  }

  return {
    recoveryDecision,
    nextDecision,
    replanRequired,
    humanInterventionRequired,
    humanKind
  };
}

export function computeGoalProgress(input: {
  companyId: number;
  stepsTotal: number;
  completedSteps: number;
  failedSteps: number;
  pendingSteps: number;
  skippedSteps?: number;
  partialSteps?: number;
}): GoalProgress {
  const config = getExecutionFeedbackConfig(input.companyId);
  const total = Math.max(input.stepsTotal, 1);
  let completed = input.completedSteps;
  if (config.progressRules.countSkippedAsCompleted) {
    completed += input.skippedSteps || 0;
  }
  if (config.progressRules.countPartialAsCompleted) {
    completed += input.partialSteps || 0;
  }
  const completionPercentage = Math.min(
    100,
    Math.round((completed / total) * 100)
  );
  return {
    completedSteps: input.completedSteps,
    pendingSteps: input.pendingSteps,
    failedSteps: input.failedSteps,
    completionPercentage,
    goalAchieved:
      completionPercentage >= config.thresholds.goalAchievedPercentage &&
      input.failedSteps === 0 &&
      input.pendingSteps === 0
  };
}

export function computeConfidence(input: {
  companyId: number;
  stepStatus: FeedbackStepStatus;
  warningCount: number;
  errorCount: number;
}): number {
  const c = getExecutionFeedbackConfig(input.companyId).confidence;
  let base =
    input.stepStatus === "SUCCESS"
      ? c.successBase
      : input.stepStatus === "PARTIAL"
        ? c.partialBase
        : input.stepStatus === "WAITING"
          ? c.waitingBase
          : c.failureBase;
  base -= input.warningCount * c.warningPenalty;
  base -= input.errorCount * c.errorPenalty;
  return Math.max(0, Math.min(1, Number(base.toFixed(3))));
}

export default {
  applyFeedbackRules,
  computeGoalProgress,
  computeConfidence
};
