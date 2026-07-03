/** Versão do avaliador dry-run (Fase IA 1.2.1). */
export const AI_AGENT_EVALUATOR_VERSION = "1.2.1";

/**
 * Quando true, persiste logs mesmo para conexões sem aiAgentId/aiAgentEnabled
 * (ex.: plan_disabled em tenant sem agente). Por omissão false para evitar volume.
 */
export const AI_AGENT_DRY_RUN_LOG_NON_CONFIGURED =
  process.env.AI_AGENT_DRY_RUN_LOG_NON_CONFIGURED === "true";

/**
 * Retenção sugerida em dias (0 = não configurado; sem purge automático nesta fase).
 */
export const AI_AGENT_DRY_RUN_LOG_RETENTION_DAYS = (() => {
  const raw = process.env.AI_AGENT_DRY_RUN_LOG_RETENTION_DAYS;
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
})();
