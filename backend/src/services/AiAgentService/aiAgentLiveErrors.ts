export const AI_AGENT_LIVE_STATUSES = {
  NOT_REQUESTED: "not_requested",
  QUEUED: "queued",
  GENERATED: "generated",
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
  RATE_LIMITED: "rate_limited"
} as const;

export type AiAgentLiveStatus =
  (typeof AI_AGENT_LIVE_STATUSES)[keyof typeof AI_AGENT_LIVE_STATUSES];

export const AI_AGENT_LIVE_DELIVERY_STATUSES = {
  NOT_SENT: "not_sent",
  SENT: "sent",
  SEND_FAILED: "send_failed"
} as const;

export type AiAgentLiveDeliveryStatus =
  (typeof AI_AGENT_LIVE_DELIVERY_STATUSES)[keyof typeof AI_AGENT_LIVE_DELIVERY_STATUSES];

export const AI_AGENT_LIVE_ERROR_CODES = {
  AI_USAGE_LIMIT_REACHED: "ai_usage_limit_reached",
  PROVIDER_TIMEOUT: "provider_timeout",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  INVALID_MODEL: "invalid_model",
  EMPTY_AI_RESPONSE: "empty_ai_response",
  AI_AUTH_ERROR: "ai_auth_error",
  CONTEXT_BUILD_FAILED: "context_build_failed",
  GENERATION_FAILED: "generation_failed",
  DEBOUNCED_SUPERSEDED: "debounced_superseded",
  NOT_LIVE_MODE: "not_live_mode",
  NOT_ELIGIBLE: "not_eligible",
  LIVE_PAUSED_FOR_TICKET: "live_paused_for_ticket",
  LIVE_HANDOFF_REQUESTED: "live_handoff_requested",
  LIVE_TICKET_LIMIT_REACHED: "live_ticket_limit_reached",
  LIVE_COOLDOWN_ACTIVE: "live_cooldown_active",
  LIVE_RESPONSE_TOO_LONG: "live_response_too_long",
  LIVE_RESPONSE_INVALID: "live_response_invalid",
  LIVE_SEND_FAILED: "live_send_failed",
  LIVE_GENERATION_FAILED: "live_generation_failed",
  LIVE_HUMAN_ASSUMED: "live_human_assumed",
  LIVE_ALREADY_SENT: "live_already_sent"
} as const;

export type AiAgentLiveErrorCode =
  (typeof AI_AGENT_LIVE_ERROR_CODES)[keyof typeof AI_AGENT_LIVE_ERROR_CODES];
