/**
 * Fase IA 2.1A — Automation Tools foundation.
 * Deny-by-default. Nenhuma Tool operacional de negócio nesta fase.
 */

export const AUTOMATION_TOOL_RUNTIME_VERSION = "2.1.0-c";

export const AUTOMATION_AI_TOOLS_FEATURE_KEY = "automation.ai_tools";

export const AUTOMATION_TOOL_STATUSES = [
  "success",
  "failure",
  "denied",
  "waiting_confirmation",
  "retry",
  "skipped"
] as const;

export type AutomationToolStatus = (typeof AUTOMATION_TOOL_STATUSES)[number];

export const AUTOMATION_TOOL_RISK_LEVELS = [
  "read_only",
  "low",
  "medium",
  "high",
  "critical"
] as const;

export type ToolRiskLevel = (typeof AUTOMATION_TOOL_RISK_LEVELS)[number];

export const AUTOMATION_TOOL_SIDE_EFFECTS = [
  "none",
  "database_read",
  "database_write",
  "message_send",
  "external_request",
  "financial",
  "destructive"
] as const;

export type ToolSideEffectType =
  (typeof AUTOMATION_TOOL_SIDE_EFFECTS)[number];

export const AUTOMATION_TOOL_CONFIRMATION_POLICIES = [
  "never",
  "admin_only",
  "human_operator",
  "customer",
  "policy_based"
] as const;

export type ToolConfirmationPolicy =
  (typeof AUTOMATION_TOOL_CONFIRMATION_POLICIES)[number];

export const AUTOMATION_TOOL_IDEMPOTENCY_TYPES = [
  "none",
  "request",
  "message",
  "execution",
  "custom"
] as const;

export type ToolIdempotencyType =
  (typeof AUTOMATION_TOOL_IDEMPOTENCY_TYPES)[number];

export const AUTOMATION_TOOL_INVOCATION_SOURCES = [
  "action",
  "planner",
  "ai_function_call",
  "workflow",
  "admin_test",
  "system"
] as const;

export type ToolInvocationSource =
  (typeof AUTOMATION_TOOL_INVOCATION_SOURCES)[number];

/** Fontes autorizadas a executar de verdade nesta fase. */
export const AUTOMATION_TOOL_PRODUCTIVE_SOURCES: ToolInvocationSource[] = [
  "action",
  "admin_test"
];

export const AUTOMATION_TOOL_ERROR_TYPES = [
  "validation",
  "permission",
  "feature",
  "tenant",
  "ownership",
  "policy",
  "confirmation",
  "idempotency",
  "timeout",
  "rate_limit",
  "not_found",
  "conflict",
  "dependency",
  "runtime",
  "provider",
  "unexpected",
  "circuit_open",
  "rollback_failed"
] as const;

export type ToolErrorType = (typeof AUTOMATION_TOOL_ERROR_TYPES)[number];

export const AUTOMATION_TOOL_CATEGORIES = [
  "system",
  "contact",
  "ticket",
  "tag",
  "queue",
  "user",
  "note",
  "handoff",
  "message",
  "integration",
  "knowledge",
  "future"
] as const;

export type ToolCategory = (typeof AUTOMATION_TOOL_CATEGORIES)[number];

export const AUTOMATION_TOOL_CAPABILITY_KEYS = [
  "tool.read",
  "tool.write",
  "tool.internal",
  "tool.external",
  "contact.read",
  "contact.write",
  "ticket.read",
  "ticket.write",
  "tag.read",
  "tag.write",
  "queue.read",
  "user.read",
  "note.write",
  "handoff.execute",
  "message.send",
  "integration.http",
  "integration.webhook",
  "integration.mcp"
] as const;

export type ToolCapabilityKey =
  (typeof AUTOMATION_TOOL_CAPABILITY_KEYS)[number];

/** Capabilities de Tools — nenhuma ativa por padrão (deny-by-default). */
export const AUTOMATION_TOOL_DEFAULT_CAPABILITIES: Record<
  ToolCapabilityKey,
  boolean
> = {
  "tool.read": false,
  "tool.write": false,
  "tool.internal": false,
  "tool.external": false,
  "contact.read": false,
  "contact.write": false,
  "ticket.read": false,
  "ticket.write": false,
  "tag.read": false,
  "tag.write": false,
  "queue.read": false,
  "user.read": false,
  "note.write": false,
  "handoff.execute": false,
  "message.send": false,
  "integration.http": false,
  "integration.webhook": false,
  "integration.mcp": false
};

export const AUTOMATION_TOOL_PERMISSIONS = [
  "aiTools.view",
  "aiTools.test",
  "aiTools.executeRead",
  "aiTools.executeWrite",
  "aiTools.manage",
  "aiTools.approve"
] as const;

export type AutomationToolPermission =
  (typeof AUTOMATION_TOOL_PERMISSIONS)[number];

export const AUTOMATION_TOOL_EVENTS = [
  "ToolDiscovered",
  "ToolExecutionRequested",
  "ToolPolicyEvaluated",
  "ToolExecutionStarted",
  "ToolExecutionRetried",
  "ToolExecutionCompleted",
  "ToolExecutionFailed",
  "ToolExecutionDenied",
  "ToolConfirmationRequested",
  "ToolRollbackStarted",
  "ToolRollbackCompleted"
] as const;

export type AutomationToolEventName =
  (typeof AUTOMATION_TOOL_EVENTS)[number];

export const AUTOMATION_TOOL_CONFIRMATION_STATUSES = [
  "none",
  "pending",
  "approved",
  "rejected",
  "expired"
] as const;

export type ToolConfirmationStatus =
  (typeof AUTOMATION_TOOL_CONFIRMATION_STATUSES)[number];

export const AUTOMATION_TOOL_ROLLBACK_STATUSES = [
  "none",
  "requested",
  "succeeded",
  "failed",
  "unsupported"
] as const;

export type ToolRollbackStatus =
  (typeof AUTOMATION_TOOL_ROLLBACK_STATUSES)[number];

export const AUTOMATION_TOOL_RATE_LIMIT_SCOPES = [
  "company",
  "ticket",
  "contact",
  "execution",
  "user"
] as const;

export type ToolRateLimitScope =
  (typeof AUTOMATION_TOOL_RATE_LIMIT_SCOPES)[number];

export const AUTOMATION_TOOL_CIRCUIT_BREAKER = {
  failureWindowMs: 5 * 60 * 1000,
  maxFailures: 5,
  maxTimeouts: 3,
  maxRollbackFailures: 2,
  openTtlSeconds: 180
} as const;

/** Limites conservadores para Tools técnicas. */
export const AUTOMATION_TOOL_TECHNICAL_RATE_LIMIT = {
  maxCalls: 30,
  windowSeconds: 60,
  scope: "company" as ToolRateLimitScope
};

export const AUTOMATION_TOOL_SNAPSHOT_MAX_BYTES = 8 * 1024;

export function isWriteSideEffect(sideEffect: ToolSideEffectType): boolean {
  return sideEffect !== "none" && sideEffect !== "database_read";
}

export function isReadOnlyRisk(risk: ToolRiskLevel): boolean {
  return risk === "read_only";
}
