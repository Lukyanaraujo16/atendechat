import { AI_AGENT_FEATURE_KEY } from "../config/aiAgentFeature";

/**
 * Módulo Agente de IA (automation.ai_agent) — gating por plano e permissão individual.
 * Helper padrão para menu, rotas e componentes do módulo.
 */
export function canUseAiAgent(user, planFlags) {
  const fx = planFlags?.effectiveFeatures || {};
  const planOn = fx[AI_AGENT_FEATURE_KEY] === true;
  if (!planOn && planFlags?.ready) {
    return false;
  }
  if (user?.effectiveUserFeatures?.[AI_AGENT_FEATURE_KEY] === false) {
    return false;
  }
  if (!planFlags?.ready) {
    return planOn !== false;
  }
  return planOn;
}

/** Alias semântico para checagens de visibilidade do módulo. */
export function hasAiAgent(user, planFlags) {
  return canUseAiAgent(user, planFlags);
}
