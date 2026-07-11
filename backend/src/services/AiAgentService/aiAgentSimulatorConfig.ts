/** Source registrado nas chamadas ao provider durante simulação. */
export const AI_AGENT_SIMULATOR_SOURCE = "ai_agent_simulator";

/** Máximo de mensagens (user + assistant) por sessão. */
export const AI_AGENT_SIMULATOR_MAX_MESSAGES_PER_SESSION = 30;

/** Máximo de mensagens do usuário por sessão. */
export const AI_AGENT_SIMULATOR_MAX_USER_MESSAGES = 10;

/** Tamanho máximo de uma mensagem do usuário. */
export const AI_AGENT_SIMULATOR_MAX_MESSAGE_CHARS = 4000;

/** Timeout da geração (ms). */
export const AI_AGENT_SIMULATOR_TIMEOUT_MS = 25_000;

/** Teto global de maxTokens por chamada. */
export const AI_AGENT_SIMULATOR_MAX_TOKENS_CAP = 1024;

/** Máximo de mensagens no histórico enviado ao modelo. */
export const AI_AGENT_SIMULATOR_CONTEXT_MAX_MESSAGES = 15;

/** Teto de caracteres do histórico enviado ao modelo. */
export const AI_AGENT_SIMULATOR_CONTEXT_MAX_CHARS = 8000;

/** Sessões ativas simultâneas por agente e usuário. */
export const AI_AGENT_SIMULATOR_MAX_OPEN_SESSIONS = 3;

export const AI_AGENT_SIMULATOR_SESSION_STATUSES = ["active", "ended"] as const;
export type AiAgentSimulatorSessionStatus =
  (typeof AI_AGENT_SIMULATOR_SESSION_STATUSES)[number];

export const AI_AGENT_SIMULATOR_MESSAGE_ROLES = [
  "user",
  "assistant",
  "system_event"
] as const;
export type AiAgentSimulatorMessageRole =
  (typeof AI_AGENT_SIMULATOR_MESSAGE_ROLES)[number];
