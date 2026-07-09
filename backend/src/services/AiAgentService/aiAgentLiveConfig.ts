/** Timeout da geração live (ms). */
export const AI_AGENT_LIVE_TIMEOUT_MS = 25_000;

/** Debounce por ticket — mesma janela do shadow. */
export const AI_AGENT_LIVE_DEBOUNCE_MS = 3_000;

/** Teto de maxTokens por chamada live. */
export const AI_AGENT_LIVE_MAX_TOKENS_CAP = 1024;

/** Limite de caracteres da resposta enviada ao WhatsApp. */
export const AI_AGENT_LIVE_MAX_RESPONSE_CHARS = 1200;

/** Máximo de respostas automáticas por ticket enquanto sem humano. */
export const AI_AGENT_LIVE_MAX_REPLIES_PER_TICKET = 5;

/** Cooldown mínimo entre respostas automáticas no mesmo ticket (ms). */
export const AI_AGENT_LIVE_COOLDOWN_MS = 5_000;

/** Falhas consecutivas de geração/envio antes de bloquear novas tentativas. */
export const AI_AGENT_LIVE_MAX_CONSECUTIVE_FAILURES = 2;

export const AI_AGENT_LIVE_SOURCE = "ai_agent_live";

export const AI_AGENT_MESSAGE_ORIGIN = "ai_agent";

/** Nesta fase, fallback não é enviado automaticamente no live. */
export const AI_AGENT_LIVE_ALLOW_FALLBACK = false;
