/**
 * AI Agent V2.10 Wave 3 — Observabilidade (sem mudança cognitiva).
 */

export const AUTOMATION_AGENTOS_OBSERVABILITY_VERSION = "2.10.0-wave3";

export const AGENTOS_OBSERVABILITY_MODULE_KEY = "observability";

export const AGENTOS_ORIGINS = [
  "planner",
  "evaluation",
  "execution",
  "runtime",
  "tool",
  "mcp",
  "feedback",
  "memory",
  "learning",
  "multi_agent",
  "replay",
  "dashboard",
  "api",
  "monitor",
  "ops",
  "system"
] as const;

export type AgentOsOrigin = (typeof AGENTOS_ORIGINS)[number];

export const AGENTOS_SEVERITIES = ["debug", "info", "warn", "error", "critical"] as const;
export type AgentOsSeverity = (typeof AGENTOS_SEVERITIES)[number];

export const AGENTOS_HEALTH_STATUSES = [
  "Healthy",
  "Degraded",
  "Critical",
  "Unknown"
] as const;
export type AgentOsHealthStatus = (typeof AGENTOS_HEALTH_STATUSES)[number];

export const AGENTOS_ALERT_TYPES = [
  "repeated_failures",
  "high_latency",
  "mcp_unavailable",
  "rate_limit",
  "critical_error",
  "loop_detected",
  "timeout",
  "delegation_blocked"
] as const;

export type AgentOsAlertType = (typeof AGENTOS_ALERT_TYPES)[number];

export const DEFAULT_AGENTOS_OBSERVABILITY_CONFIG = {
  enabled: true,
  persistEvents: true,
  persistMetrics: true,
  persistTimelines: true,
  persistAlerts: true,
  maxInMemoryEvents: 5_000,
  maxInMemoryTimelines: 1_000,
  maxInMemoryAlerts: 500,
  latencyWarnMs: 2_000,
  latencyCriticalMs: 8_000,
  repeatedFailureThreshold: 5,
  liveIntegrationAllowed: false
} as const;

export type AgentOsObservabilityConfig = typeof DEFAULT_AGENTOS_OBSERVABILITY_CONFIG;
