/** Razões padronizadas da avaliação dry-run do Agente de IA. */
export const AI_AGENT_EVALUATION_REASONS = {
  PLAN_DISABLED: "plan_disabled",
  WHATSAPP_AI_AGENT_DISABLED: "whatsapp_ai_agent_disabled",
  WHATSAPP_AI_AGENT_MISSING: "whatsapp_ai_agent_missing",
  AI_AGENT_NOT_FOUND: "ai_agent_not_found",
  AI_AGENT_DISABLED: "ai_agent_disabled",
  MESSAGE_FROM_ME: "message_from_me",
  GROUP_MESSAGE: "group_message",
  TICKET_HAS_HUMAN_USER: "ticket_has_human_user",
  TICKET_CHATBOT_ACTIVE: "ticket_chatbot_active",
  TICKET_FLOW_ACTIVE: "ticket_flow_active",
  TICKET_INTEGRATION_ACTIVE: "ticket_integration_active",
  CHATBOT_BYPASS: "chatbot_bypass",
  CAMPAIGN_OR_SYSTEM_MESSAGE: "campaign_or_system_message",
  TICKET_CLOSED: "ticket_closed",
  TICKET_AI_PAUSED: "ticket_ai_paused",
  AI_AGENT_HANDOFF_REQUESTED: "ai_agent_handoff_requested",
  LIVE_TICKET_LIMIT_REACHED: "live_ticket_limit_reached",
  LIVE_COOLDOWN_ACTIVE: "live_cooldown_active",
  UNSUPPORTED_CHANNEL: "unsupported_channel",
  DUPLICATE_MESSAGE: "duplicate_message",
  MESSAGE_ID_MISSING: "message_id_missing",
  AUDIO_NOT_SUPPORTED: "audio_not_supported",
  MEDIA_NOT_SUPPORTED: "media_not_supported",
  UNSUPPORTED_MESSAGE_TYPE: "unsupported_message_type",
  EMPTY_MESSAGE_BODY: "empty_message_body",
  ELIGIBLE: "eligible",
  UNEXPECTED_ERROR: "unexpected_error"
} as const;

export type AiAgentEvaluationReason =
  (typeof AI_AGENT_EVALUATION_REASONS)[keyof typeof AI_AGENT_EVALUATION_REASONS];

export type AiAgentEvaluationMode = "dry_run" | "shadow" | "live";

export type AiAgentEvaluationResult = {
  eligible: boolean;
  reason: AiAgentEvaluationReason;
  aiAgentId?: number;
  mode: AiAgentEvaluationMode;
  metadata?: Record<string, unknown>;
  evaluationDurationMs?: number;
};
