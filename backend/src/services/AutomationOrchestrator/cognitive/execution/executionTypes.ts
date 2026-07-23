import {
  ExecutionSessionStatus,
  SessionEventName,
  StepEventName,
  AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION
} from "../../../../config/automationExecutionOrchestratorConstants";

export type ExecutionGraphNode = {
  nodeId: string;
  stepId: string;
  type: string;
  objective: string;
  dependencies: string[];
  children: string[];
  parents: string[];
  parallelGroup: number;
  checkpoint: boolean;
  optional: boolean;
  retryable: boolean;
  requiresConfirmation: boolean;
};

export type ExecutionGraph = {
  planId: string;
  nodes: ExecutionGraphNode[];
  order: string[];
  parallelGroups: string[][];
  edges: Array<{ from: string; to: string }>;
  entryNodeIds: string[];
  exitNodeIds: string[];
};

export type ExecutionCheckpoint = {
  id: string;
  sessionId: string;
  stepId: string | null;
  kind: "checkpoint" | "snapshot" | "rollback_point";
  label: string;
  createdAt: string;
  snapshot: Record<string, unknown>;
};

export type ExecutionEvent = {
  id: string;
  sessionId: string;
  kind: "session" | "step";
  name: SessionEventName | StepEventName | string;
  stepId?: string | null;
  message?: string;
  at: string;
  meta?: Record<string, unknown>;
};

export type ExecutionSessionTimestamps = {
  createdAt: string;
  readyAt?: string | null;
  startedAt?: string | null;
  pausedAt?: string | null;
  resumedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  abortedAt?: string | null;
  updatedAt: string;
};

export type ExecutionSessionMetrics = {
  stepsTotal: number;
  stepsCompleted: number;
  stepsFailed: number;
  stepsSkipped: number;
  retries: number;
  pauses: number;
  waitingCount: number;
  recoveries: number;
  durationMs: number;
};

export type ExecutionSession = {
  id: string;
  companyId: number;
  goalId: string;
  planId: string;
  evaluationId: string | null;
  status: ExecutionSessionStatus;
  currentStepId: string | null;
  completedSteps: string[];
  failedSteps: string[];
  skippedSteps: string[];
  pendingSteps: string[];
  waitingSteps: string[];
  executionContext: Record<string, unknown>;
  validationState: Record<string, unknown>;
  recoveryState: {
    active: boolean;
    lastAction: string | null;
    attempts: number;
    history: Array<{ stepId: string; action: string; at: string }>;
  };
  graph: ExecutionGraph;
  checkpoints: ExecutionCheckpoint[];
  events: ExecutionEvent[];
  timestamps: ExecutionSessionTimestamps;
  metrics: ExecutionSessionMetrics;
  metadata: Record<string, unknown>;
  version: string;
};

export type NextStepDecision = {
  ready: string[];
  blocked: Array<{ stepId: string; reason: string }>;
  waitingConfirmation: string[];
  waitingRecovery: string[];
  nextStepId: string | null;
};

export type RecoveryDecision = {
  action: "RETRY" | "SKIP" | "ABORT" | "ASK_CONFIRMATION" | "REPLAN";
  stepId: string;
  reason: string;
  autoExecute: false;
};

export type ExecutionReplayRecord = {
  id: string;
  companyId: number;
  sessionId: string;
  goal: unknown;
  plan: unknown;
  evaluation: unknown;
  session: ExecutionSession;
  stepTimeline: ExecutionEvent[];
  actionExecutions?: unknown[];
  recovery: ExecutionSession["recoveryState"];
  finalState: ExecutionSessionStatus;
  createdAt: string;
};

export { AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION };
