/**
 * Constantes da Fase IA 1.5.3 — Analytics / Observabilidade / Aprendizado assistido.
 * Nunca altera documentos, embeddings, prompts ou perfil automaticamente.
 */

/** Frequência mínima de gap para sugerir FAQ (nunca cria FAQ sozinho). */
export const AI_ANALYTICS_FAQ_SUGGESTION_MIN_FREQUENCY = 5;

/** Limite de preview de pergunta/resposta persistido. */
export const AI_ANALYTICS_PREVIEW_MAX_CHARS = 240;

/** Limite do snapshot de replay (prompt/contexto truncados). */
export const AI_ANALYTICS_REPLAY_PROMPT_MAX_CHARS = 12000;
export const AI_ANALYTICS_REPLAY_CONTEXT_MAX_CHARS = 8000;

/**
 * Fórmula do Health Score (0–100) — pesos documentados e ajustáveis.
 *
 * score = clamp(
 *   100
 *   - missRate        * W_MISS
 *   - handoffRate     * W_HANDOFF
 *   - failureRate     * W_FAILURE
 *   - latencyPenalty  (0..W_LATENCY)
 *   - coveragePenalty (0..W_COVERAGE)
 * , 0, 100)
 *
 * Onde rates ∈ [0,1] no período analisado.
 * latencyPenalty = min(W_LATENCY, avgRetrievalMs / LATENCY_REF_MS * W_LATENCY)
 * coveragePenalty = W_COVERAGE se não houver documentos indexados vinculados; senão 0.
 */
export const AI_AGENT_HEALTH_SCORE_WEIGHTS = {
  W_MISS: 25,
  W_HANDOFF: 20,
  W_FAILURE: 25,
  W_LATENCY: 15,
  W_COVERAGE: 15,
  LATENCY_REF_MS: 3000
} as const;

export const AI_KNOWLEDGE_GAP_REASONS = [
  "empty_retrieval",
  "below_minimum_score",
  "handoff_knowledge_missing",
  "ask_clarification_knowledge_missing"
] as const;

export type AiKnowledgeGapReason = (typeof AI_KNOWLEDGE_GAP_REASONS)[number];

export const AI_KNOWLEDGE_GAP_STATUSES = [
  "open",
  "resolved",
  "ignored"
] as const;

export const AI_KNOWLEDGE_SUGGESTION_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "ignored"
] as const;

export const AI_KNOWLEDGE_SUGGESTION_ORIGINS = [
  "shadow_review",
  "live_human_override",
  "knowledge_gap_faq",
  "manual"
] as const;
