/** Máximo de mensagens no histórico enviado ao modelo. */
export const AI_AGENT_CONTEXT_MAX_MESSAGES = 15;

/** Teto de caracteres do histórico (aproximação de tokens). */
export const AI_AGENT_CONTEXT_MAX_CHARS = 8000;

/** Tamanho máximo da sugestão persistida. */
export const AI_AGENT_SUGGESTED_REPLY_MAX_CHARS = 4000;

/** Timeout da geração shadow (ms). */
export const AI_AGENT_SHADOW_TIMEOUT_MS = 25_000;

/**
 * Debounce por ticket para mensagens consecutivas (ms).
 * Usa helper Debounce in-memory do projeto; apenas a última mensagem do burst gera sugestão.
 */
export const AI_AGENT_SHADOW_DEBOUNCE_MS = 3_000;

/** Teto global de maxTokens por chamada shadow. */
export const AI_AGENT_SHADOW_MAX_TOKENS_CAP = 1024;

export const AI_AGENT_SHADOW_SOURCE = "ai_agent_shadow";
