/**
 * AI Agent V2.2 — Execution Orchestrator.
 * Controla ciclo de vida da sessão. Não executa Tools / Runtime / Providers.
 */

export const AUTOMATION_EXECUTION_ORCHESTRATOR_VERSION = "2.2.0";

export const EXECUTION_SESSION_STATUSES = [
  "CREATED",
  "READY",
  "RUNNING",
  "WAITING_CONFIRMATION",
  "WAITING_INPUT",
  "PAUSED",
  "RECOVERING",
  "COMPLETED",
  "FAILED",
  "ABORTED"
] as const;

export type ExecutionSessionStatus =
  (typeof EXECUTION_SESSION_STATUSES)[number];

export const STEP_EVENTS = [
  "STEP_STARTED",
  "STEP_COMPLETED",
  "STEP_SKIPPED",
  "STEP_FAILED",
  "STEP_WAITING",
  "STEP_RETRY",
  "STEP_ABORTED"
] as const;

export type StepEventName = (typeof STEP_EVENTS)[number];

export const SESSION_EVENTS = [
  "SESSION_CREATED",
  "SESSION_STARTED",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "SESSION_COMPLETED",
  "SESSION_FAILED",
  "SESSION_ABORTED"
] as const;

export type SessionEventName = (typeof SESSION_EVENTS)[number];

/** Transições válidas da state machine. */
export const VALID_SESSION_TRANSITIONS: Record<
  ExecutionSessionStatus,
  ExecutionSessionStatus[]
> = {
  CREATED: ["READY", "ABORTED"],
  READY: ["RUNNING", "ABORTED", "PAUSED"],
  RUNNING: [
    "WAITING_CONFIRMATION",
    "WAITING_INPUT",
    "RECOVERING",
    "COMPLETED",
    "FAILED",
    "PAUSED",
    "ABORTED"
  ],
  WAITING_CONFIRMATION: ["RUNNING", "ABORTED", "FAILED", "PAUSED"],
  WAITING_INPUT: ["RUNNING", "ABORTED", "FAILED", "PAUSED"],
  PAUSED: ["RUNNING", "ABORTED", "FAILED"],
  RECOVERING: ["RUNNING", "FAILED", "ABORTED", "WAITING_CONFIRMATION"],
  COMPLETED: [],
  FAILED: [],
  ABORTED: []
};

export const DEFAULT_EXECUTION_ORCHESTRATOR_CONFIG = {
  defaultTimeoutMs: 60_000,
  autoCheckpoint: true,
  maxRetries: 2,
  maxPauses: 5,
  maxStepsPerSession: 50,
  maxWaitingMs: 300_000,
  allowParallelPlanning: false
} as const;

export type ExecutionOrchestratorConfig = {
  defaultTimeoutMs: number;
  autoCheckpoint: boolean;
  maxRetries: number;
  maxPauses: number;
  maxStepsPerSession: number;
  maxWaitingMs: number;
  allowParallelPlanning: boolean;
};

export const EXECUTION_ORCHESTRATOR_SETTING_KEY =
  "automationExecutionOrchestrator";
