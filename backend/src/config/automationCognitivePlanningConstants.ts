/**
 * AI Agent V2.0 — Cognitive Planning Engine.
 * Planeja apenas. Não executa Tools, não conhece providers/runtime.
 */

export const AUTOMATION_COGNITIVE_PLANNING_VERSION = "2.0.0";

export const GOAL_TYPES = [
  "ANSWER_QUESTION",
  "SEARCH_INFORMATION",
  "UPDATE_CONTACT",
  "TRANSFER_TICKET",
  "SEND_MESSAGE",
  "EXECUTE_AUTOMATION",
  "SCHEDULE_EVENT",
  "MULTI_STEP_TASK",
  "CUSTOM"
] as const;

export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type GoalRiskLevel = (typeof GOAL_RISK_LEVELS)[number];

export const EXECUTION_STEP_TYPES = [
  "analyze",
  "gather_context",
  "search",
  "compose_answer",
  "update_entity",
  "transfer",
  "send_message",
  "schedule",
  "confirm",
  "automation",
  "custom"
] as const;

export type ExecutionStepType = (typeof EXECUTION_STEP_TYPES)[number];

export const PLAN_STATUSES = [
  "draft",
  "ready",
  "validated",
  "recovery_suggested",
  "aborted",
  "completed"
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const STEP_STATUSES = [
  "pending",
  "ready",
  "skipped",
  "valid",
  "partial",
  "failed"
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const VALIDATION_RESULTS = [
  "VALID",
  "FAILED",
  "PARTIAL",
  "SKIPPED"
] as const;

export type ValidationResult = (typeof VALIDATION_RESULTS)[number];

export const RECOVERY_ACTIONS = [
  "ABORT",
  "RETRY",
  "REPLAN",
  "ASK_CONFIRMATION",
  "SKIP"
] as const;

export type RecoveryAction = (typeof RECOVERY_ACTIONS)[number];
