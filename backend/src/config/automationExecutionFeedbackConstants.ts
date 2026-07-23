/**
 * AI Agent V2.5 — Execution Feedback Engine.
 * Interpreta Runtime Results sob ótica cognitiva. Sem Tool / Planner / Provider.
 */

export const AUTOMATION_EXECUTION_FEEDBACK_VERSION = "2.5.0";

export const FEEDBACK_STEP_STATUSES = [
  "SUCCESS",
  "FAILED",
  "WAITING",
  "PARTIAL",
  "SKIPPED",
  "ABORTED"
] as const;

export type FeedbackStepStatus = (typeof FEEDBACK_STEP_STATUSES)[number];

export const FEEDBACK_RECOVERY_DECISIONS = [
  "NONE",
  "RETRY",
  "SKIP",
  "REPLAN",
  "ASK_CONFIRMATION",
  "ASK_INPUT",
  "ABORT"
] as const;

export type FeedbackRecoveryDecision =
  (typeof FEEDBACK_RECOVERY_DECISIONS)[number];

export const FEEDBACK_NEXT_DECISIONS = [
  "CONTINUE",
  "WAIT",
  "STOP",
  "FINISH",
  "REPLAN"
] as const;

export type FeedbackNextDecision = (typeof FEEDBACK_NEXT_DECISIONS)[number];

export const FEEDBACK_EVENTS = [
  "FEEDBACK_CREATED",
  "SESSION_UPDATED",
  "GOAL_PROGRESS_UPDATED",
  "RECOVERY_REQUESTED",
  "REPLAN_REQUESTED",
  "HUMAN_INTERVENTION_REQUESTED"
] as const;

export type FeedbackEventName = (typeof FEEDBACK_EVENTS)[number];

export const DEFAULT_EXECUTION_FEEDBACK_CONFIG = {
  thresholds: {
    goalAchievedPercentage: 100,
    partialSuccessConfidence: 0.55,
    highConfidence: 0.8,
    lowConfidence: 0.35
  },
  recoveryRules: {
    onFailureRetryable: "RETRY" as FeedbackRecoveryDecision,
    onFailureOptional: "SKIP" as FeedbackRecoveryDecision,
    onFailureNonRecoverable: "ABORT" as FeedbackRecoveryDecision,
    onWaitingConfirmation: "ASK_CONFIRMATION" as FeedbackRecoveryDecision,
    onWaitingInput: "ASK_INPUT" as FeedbackRecoveryDecision,
    onDenied: "REPLAN" as FeedbackRecoveryDecision,
    onTimeout: "RETRY" as FeedbackRecoveryDecision,
    maxRecoveryAttempts: 2
  },
  progressRules: {
    countPartialAsCompleted: false,
    countSkippedAsCompleted: true
  },
  confidence: {
    successBase: 0.92,
    partialBase: 0.6,
    waitingBase: 0.5,
    failureBase: 0.2,
    warningPenalty: 0.05,
    errorPenalty: 0.12
  },
  executesTools: false,
  callsPlanner: false
} as const;

export type ExecutionFeedbackConfig = {
  thresholds: {
    goalAchievedPercentage: number;
    partialSuccessConfidence: number;
    highConfidence: number;
    lowConfidence: number;
  };
  recoveryRules: {
    onFailureRetryable: FeedbackRecoveryDecision;
    onFailureOptional: FeedbackRecoveryDecision;
    onFailureNonRecoverable: FeedbackRecoveryDecision;
    onWaitingConfirmation: FeedbackRecoveryDecision;
    onWaitingInput: FeedbackRecoveryDecision;
    onDenied: FeedbackRecoveryDecision;
    onTimeout: FeedbackRecoveryDecision;
    maxRecoveryAttempts: number;
  };
  progressRules: {
    countPartialAsCompleted: boolean;
    countSkippedAsCompleted: boolean;
  };
  confidence: {
    successBase: number;
    partialBase: number;
    waitingBase: number;
    failureBase: number;
    warningPenalty: number;
    errorPenalty: number;
  };
  executesTools: false;
  callsPlanner: false;
};

export const EXECUTION_FEEDBACK_SETTING_KEY = "automationExecutionFeedback";
