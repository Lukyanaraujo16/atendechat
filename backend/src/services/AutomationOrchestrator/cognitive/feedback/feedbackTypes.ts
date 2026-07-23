import {
  FeedbackEventName,
  FeedbackNextDecision,
  FeedbackRecoveryDecision,
  FeedbackStepStatus,
  AUTOMATION_EXECUTION_FEEDBACK_VERSION
} from "../../../../config/automationExecutionFeedbackConstants";
import { ExecutionSessionStatus } from "../../../../config/automationExecutionOrchestratorConstants";

export type GoalProgress = {
  completedSteps: number;
  pendingSteps: number;
  failedSteps: number;
  completionPercentage: number;
  goalAchieved: boolean;
};

export type FeedbackKnowledge = {
  entitiesFound: Array<{ key: string; value: string }>;
  entitiesMissing: string[];
  changesMade: string[];
  constraintsFound: string[];
  warnings: string[];
  errors: string[];
};

export type HumanIntervention = {
  required: boolean;
  kind: "NONE" | "CONFIRMATION" | "INPUT" | "MANUAL_REVIEW";
  reason: string | null;
};

export type ExecutionFeedback = {
  feedbackId: string;
  sessionId: string;
  actionId: string;
  runtimeRequestId: string;
  runtimeResultId: string;
  goalProgress: GoalProgress;
  stepStatus: FeedbackStepStatus;
  executionState: ExecutionSessionStatus | string;
  recoveryDecision: FeedbackRecoveryDecision;
  nextDecision: FeedbackNextDecision;
  humanIntervention: HumanIntervention;
  replanRequired: boolean;
  knowledge: FeedbackKnowledge;
  confidence: number;
  summary: string;
  metadata: Record<string, unknown>;
};

export type FeedbackEvent = {
  id: string;
  feedbackId: string;
  name: FeedbackEventName | string;
  at: string;
  message?: string;
  meta?: Record<string, unknown>;
};

export type SessionUpdateResult = {
  sessionId: string;
  previousStatus: string;
  nextStatus: string;
  currentStepId: string | null;
  completedSteps: string[];
  failedSteps: string[];
  pendingSteps: string[];
  waitingSteps: string[];
  metrics: Record<string, number>;
  timelineAppended: number;
  historyEntry: {
    feedbackId: string;
    stepId: string | null;
    stepStatus: FeedbackStepStatus;
    at: string;
  };
};

export type FeedbackProcessRecord = {
  id: string;
  companyId: number;
  feedback: ExecutionFeedback;
  sessionUpdate: SessionUpdateResult;
  events: FeedbackEvent[];
  createdAt: string;
};

export type FeedbackReplaySlice = {
  runtimeResult: Record<string, unknown>;
  feedback: ExecutionFeedback;
  sessionUpdate: SessionUpdateResult;
  finalState: string;
};

export { AUTOMATION_EXECUTION_FEEDBACK_VERSION };
