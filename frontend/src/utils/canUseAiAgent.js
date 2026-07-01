/**
 * Módulo Agente de IA (automation.ai_agent) — gating por plano e permissão individual.
 * Fase 0.1: apenas leitura da feature; runtime do agente ainda não implementado.
 */
export function canUseAiAgent(user, planFlags) {
  const fx = planFlags?.effectiveFeatures || {};
  const planOn = fx["automation.ai_agent"] === true;
  if (!planOn && planFlags?.ready) {
    return false;
  }
  if (user?.effectiveUserFeatures?.["automation.ai_agent"] === false) {
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
