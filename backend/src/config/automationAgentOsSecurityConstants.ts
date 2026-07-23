/**
 * AI Agent V2.10 Wave 2 — Security Hardening (sem mudança cognitiva).
 */

export const AUTOMATION_AGENTOS_SECURITY_VERSION = "2.10.0-wave2";

/** Feature flags oficiais AgentOS (catálogo de planos). */
export const AGENTOS_FEATURE_KEYS = {
  ai: "automation.ai",
  aiAgent: "automation.ai_agent",
  aiTools: "automation.ai_tools",
  memory: "automation.memory",
  learning: "automation.learning",
  mcp: "automation.mcp",
  multiAgent: "automation.multi_agent",
  runtime: "automation.runtime",
  replay: "automation.replay",
  monitor: "automation.monitor",
  dashboard: "automation.dashboard",
  tester: "automation.tester",
  production: "automation.production"
} as const;

export type AgentOsFeatureKey =
  (typeof AGENTOS_FEATURE_KEYS)[keyof typeof AGENTOS_FEATURE_KEYS];

/** Alias pedidos na Wave 2 + keys já existentes. */
export const AGENTOS_OFFICIAL_FEATURE_CATALOG: AgentOsFeatureKey[] = [
  AGENTOS_FEATURE_KEYS.ai,
  AGENTOS_FEATURE_KEYS.aiAgent,
  AGENTOS_FEATURE_KEYS.aiTools,
  AGENTOS_FEATURE_KEYS.memory,
  AGENTOS_FEATURE_KEYS.learning,
  AGENTOS_FEATURE_KEYS.mcp,
  AGENTOS_FEATURE_KEYS.multiAgent,
  AGENTOS_FEATURE_KEYS.runtime,
  AGENTOS_FEATURE_KEYS.replay,
  AGENTOS_FEATURE_KEYS.monitor,
  AGENTOS_FEATURE_KEYS.dashboard,
  AGENTOS_FEATURE_KEYS.tester,
  AGENTOS_FEATURE_KEYS.production
];

export const AGENTOS_RATE_LIMITS = {
  adminApi: { windowMs: 60_000, max: 120 },
  tester: { windowMs: 60_000, max: 30 },
  simulation: { windowMs: 60_000, max: 20 },
  replay: { windowMs: 60_000, max: 30 },
  learning: { windowMs: 60_000, max: 20 },
  coordination: { windowMs: 60_000, max: 15 },
  delegation: { windowMs: 60_000, max: 15 },
  handoff: { windowMs: 60_000, max: 15 },
  dashboardHeavy: { windowMs: 60_000, max: 40 },
  mcp: { windowMs: 60_000, max: 40 }
} as const;

export const AGENTOS_PAYLOAD_LIMITS = {
  maxJsonBytes: 512_000,
  maxStringLength: 8_000,
  maxArrayLength: 500,
  maxReplayItems: 200,
  maxSimulationSamples: 200,
  maxIdLength: 128,
  maxSlugLength: 128
} as const;

export const AGENTOS_SENSITIVE_OPS = [
  "delete",
  "archive",
  "rollback",
  "promote",
  "approve",
  "suspend",
  "deactivate",
  "restore",
  "mass_update",
  "put_config"
] as const;

export type AgentOsSensitiveOp = (typeof AGENTOS_SENSITIVE_OPS)[number];

export const AGENTOS_SECRET_KEY_RE =
  /api[_-]?key|password|secret|token|authorization|cookie|credential|private[_-]?key|bearer|refresh/i;

export const DEFAULT_AGENTOS_SECURITY_CONFIG = {
  enabled: true,
  failClosedOnPlanLookupError: true,
  requireConfirmationForSensitiveOps: true,
  stripSecretsFromLogs: true,
  stripSecretsFromResponses: true,
  liveIntegrationAllowed: false,
  multiAgentLiveAllowed: false,
  learningAutoPromotionAllowed: false,
  rateLimits: AGENTOS_RATE_LIMITS,
  payloadLimits: AGENTOS_PAYLOAD_LIMITS,
  securityHeaders: {
    contentTypeOptions: "nosniff",
    frameOptions: "DENY",
    referrerPolicy: "no-referrer",
    permissionsPolicy: "camera=(), microphone=(), geolocation=()",
    hstsMaxAgeSeconds: 31536000
  }
} as const;

export type AgentOsSecurityConfig = typeof DEFAULT_AGENTOS_SECURITY_CONFIG;
