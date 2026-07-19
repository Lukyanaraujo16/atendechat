/**
 * Fase IA 2.0.2 — Action Contract + Runtime universal.
 * Comportamento das Actions existentes preservado; legado permanece fallback.
 */

export const AUTOMATION_PLANNER_VERSION = "2.0.2";

export const AUTOMATION_ACTION_RUNTIME_VERSION = "2.0.2";

export const AUTOMATION_EXECUTION_STATUSES = [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "handoff"
] as const;

export type AutomationExecutionStatus =
  (typeof AUTOMATION_EXECUTION_STATUSES)[number];

export const AUTOMATION_ACTION_RESULTS = [
  "success",
  "failure",
  "waiting",
  "handoff",
  "retry",
  "skip"
] as const;

export type AutomationActionResultStatus =
  (typeof AUTOMATION_ACTION_RESULTS)[number];

export const AUTOMATION_INTENTS = [
  "chatbot",
  "flow",
  "knowledge",
  "live_agent",
  "human",
  "integration",
  "unknown"
] as const;

export type AutomationIntent = (typeof AUTOMATION_INTENTS)[number];

/** Modos de ativação gradual (2.0.1). */
export const AUTOMATION_CONTROL_MODES = [
  "disabled",
  "observe",
  "shadow_execute",
  "active_partial",
  "active"
] as const;

export type AutomationControlMode = (typeof AUTOMATION_CONTROL_MODES)[number];

/** Observe por padrão — não assume o atendimento em produção. */
export const AUTOMATION_DEFAULT_CONTROL_MODE: AutomationControlMode = "observe";

export const AUTOMATION_CAPABILITY_KEYS = [
  "planner",
  "classification",
  "knowledge",
  "ai_generation",
  "chatbot",
  "flows",
  "handoff",
  "send_message",
  "integrations",
  "wait"
] as const;

export type AutomationCapabilityKey =
  (typeof AUTOMATION_CAPABILITY_KEYS)[number];

/** Capabilities futuras (registry); ainda não ativas no engine. */
export const AUTOMATION_FUTURE_CAPABILITY_KEYS = [
  "future.http",
  "future.erp",
  "future.mcp",
  "future.payment",
  "future.webhook",
  "future.crm",
  "future.inventory",
  "future.calendar"
] as const;

export type AutomationFutureCapabilityKey =
  (typeof AUTOMATION_FUTURE_CAPABILITY_KEYS)[number];

export type AutomationCapabilityId =
  | AutomationCapabilityKey
  | AutomationFutureCapabilityKey
  | string;

export const AUTOMATION_ACTION_CATEGORIES = [
  "planner",
  "knowledge",
  "chatbot",
  "flow",
  "integration",
  "communication",
  "human",
  "system",
  "future"
] as const;

export type AutomationActionCategory =
  (typeof AUTOMATION_ACTION_CATEGORIES)[number];

export const AUTOMATION_ACTION_ERROR_CODES = [
  "validation",
  "runtime",
  "timeout",
  "permission",
  "capability",
  "unexpected",
  "not_found",
  "rollback_failed"
] as const;

export type AutomationActionErrorCode =
  (typeof AUTOMATION_ACTION_ERROR_CODES)[number];

export const AUTOMATION_CAPABILITY_MODES = [
  "legacy",
  "observe",
  "shadow",
  "active"
] as const;

export type AutomationCapabilityMode =
  (typeof AUTOMATION_CAPABILITY_MODES)[number];

export const AUTOMATION_OWNERSHIP = ["legacy", "orchestrator"] as const;
export type AutomationOwnership = (typeof AUTOMATION_OWNERSHIP)[number];

export const AUTOMATION_DIVERGENCE_SEVERITIES = [
  "match",
  "info",
  "warning",
  "critical"
] as const;

export type AutomationDivergenceSeverity =
  (typeof AUTOMATION_DIVERGENCE_SEVERITIES)[number];

/** Defaults: tudo legacy/observe — legado é o owner. */
export const AUTOMATION_DEFAULT_CAPABILITIES: Record<
  AutomationCapabilityKey,
  AutomationCapabilityMode
> = {
  planner: "observe",
  classification: "observe",
  knowledge: "observe",
  ai_generation: "observe",
  chatbot: "legacy",
  flows: "legacy",
  handoff: "legacy",
  send_message: "legacy",
  integrations: "legacy",
  wait: "observe"
};

export const AUTOMATION_EVENTS = [
  "ExecutionStarted",
  "ActionStarted",
  "ActionFinished",
  "ExecutionCompleted",
  "ExecutionFailed",
  "HandoffRequested",
  "KnowledgeRetrieved",
  "AIResponseGenerated",
  "ExecutionWaiting",
  "ExecutionResumed",
  "OwnershipResolved",
  "CircuitBreakerTripped",
  "FallbackToLegacy",
  "PlannerValidated",
  "CapabilityBlocked"
] as const;

export type AutomationEventName = (typeof AUTOMATION_EVENTS)[number];

/** Circuit breaker thresholds (documentados / ajustáveis). */
export const AUTOMATION_CIRCUIT_BREAKER = {
  failureWindowMs: 5 * 60 * 1000,
  maxFailures: 8,
  maxCriticalDivergences: 5,
  maxLatencyMs: 15000,
  openTtlSeconds: 300
} as const;

export const AUTOMATION_ORCHESTRATOR_FEATURE_KEY = "automation.ai_agent";

/** Mapa Action → capability principal. */
export const AUTOMATION_ACTION_CAPABILITY_MAP: Record<
  string,
  AutomationCapabilityKey
> = {
  ClassifyIntentAction: "classification",
  LogExecutionAction: "planner",
  KnowledgeRetrievalAction: "knowledge",
  GenerateAIResponseAction: "ai_generation",
  HumanHandoffAction: "handoff",
  ChatbotAction: "chatbot",
  FlowAction: "flows",
  WaitForMessageAction: "wait",
  FinishExecutionAction: "planner"
};
