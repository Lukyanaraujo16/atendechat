/**
 * AI Agent V2.10 Wave 1 — Persistência real (Sequelize).
 * Sem novas capacidades cognitivas. Somente store → DB.
 */

export const AUTOMATION_AGENTOS_PERSISTENCE_VERSION = "2.10.0-wave1";

/** memory = testes unitários legados; sequelize = produção / testes de persistência */
export type AgentOsPersistenceBackend = "memory" | "sequelize";

export function getAgentOsPersistenceBackend(): AgentOsPersistenceBackend {
  const forced = process.env.AGENTOS_PERSISTENCE?.trim().toLowerCase();
  if (forced === "sequelize" || forced === "memory") return forced;
  if (process.env.NODE_ENV === "test") return "memory";
  return "sequelize";
}

export const AGENTOS_DOCUMENT_ENTITY_TYPES = [
  // Learning
  "learning.analysis",
  "learning.dataset",
  "learning.pattern",
  "learning.candidate",
  "learning.evaluation",
  "learning.artifact",
  "learning.feedback",
  "learning.shadow",
  "learning.planner_guidance",
  "learning.runtime_guidance",
  "learning.strategy_guidance",
  // Multi-Agent secondary
  "multiAgent.capability",
  "multiAgent.sticky",
  "multiAgent.routing_context",
  "multiAgent.selection",
  "multiAgent.specialized_context",
  "multiAgent.boundary",
  "multiAgent.delegation",
  "multiAgent.delegated_session",
  "multiAgent.delegation_result",
  "multiAgent.handoff",
  "multiAgent.handoff_result",
  "multiAgent.coordination",
  "multiAgent.message",
  "multiAgent.conflict",
  "multiAgent.intervention",
  "multiAgent.health",
  // Cognitive secondary
  "cognitive.goal",
  "cognitive.plan",
  "cognitive.plan_replay",
  "cognitive.plan_validation",
  "cognitive.recovery",
  "cognitive.plan_evaluation",
  "cognitive.plan_diff",
  "cognitive.action_replay",
  "cognitive.feedback_record",
  "cognitive.feedback_event",
  "cognitive.memory_replay",
  "runtime.integration_record",
  "runtime.integration_event",
  "runtime.integration_replay",
  "action.execution_result"
] as const;

export type AgentOsDocumentEntityType =
  (typeof AGENTOS_DOCUMENT_ENTITY_TYPES)[number];

export const AGENTOS_MODULE_KEYS = [
  "learning",
  "multiAgent",
  "mcp",
  "cognitiveMemory",
  "executionFeedback",
  "executionOrchestrator",
  "planEvaluation",
  "actionExecution",
  "runtimeIntegration"
] as const;

export type AgentOsModuleKey = (typeof AGENTOS_MODULE_KEYS)[number];

/** Retenção padrão (dias) — limpeza administrativa Wave 2 */
export const AGENTOS_RETENTION_DAYS = {
  audits: 90,
  events: 60,
  metrics: 180,
  replays: 30,
  documents: 365,
  memories: 365,
  idempotency: 7
} as const;
