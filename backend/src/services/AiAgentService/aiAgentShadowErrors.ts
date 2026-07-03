export const AI_AGENT_SHADOW_ERROR_CODES = {
  AI_USAGE_LIMIT_REACHED: "ai_usage_limit_reached",
  PROVIDER_TIMEOUT: "provider_timeout",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  INVALID_MODEL: "invalid_model",
  EMPTY_AI_RESPONSE: "empty_ai_response",
  AI_AUTH_ERROR: "ai_auth_error",
  CONTEXT_BUILD_FAILED: "context_build_failed",
  GENERATION_FAILED: "generation_failed",
  DEBOUNCED_SUPERSEDED: "debounced_superseded",
  NOT_SHADOW_MODE: "not_shadow_mode",
  NOT_ELIGIBLE: "not_eligible"
} as const;

export type AiAgentShadowErrorCode =
  (typeof AI_AGENT_SHADOW_ERROR_CODES)[keyof typeof AI_AGENT_SHADOW_ERROR_CODES];

export const AI_AGENT_SHADOW_STATUSES = {
  NOT_REQUESTED: "not_requested",
  QUEUED: "queued",
  GENERATED: "generated",
  SKIPPED: "skipped",
  FAILED: "failed",
  RATE_LIMITED: "rate_limited"
} as const;

export type AiAgentShadowStatus =
  (typeof AI_AGENT_SHADOW_STATUSES)[keyof typeof AI_AGENT_SHADOW_STATUSES];
