import { KNOWLEDGE_BASE_FEATURE_KEY } from "../config/knowledgeBaseFeature";

/**
 * Módulo Base de Conhecimento (automation.knowledge_base).
 */
export function canUseKnowledgeBase(user, planFlags) {
  const fx = planFlags?.effectiveFeatures || {};
  const planOn = fx[KNOWLEDGE_BASE_FEATURE_KEY] === true;
  if (!planOn && planFlags?.ready) {
    return false;
  }
  if (user?.effectiveUserFeatures?.[KNOWLEDGE_BASE_FEATURE_KEY] === false) {
    return false;
  }
  if (!planFlags?.ready) {
    return planOn !== false;
  }
  return planOn;
}

export function hasKnowledgeBase(user, planFlags) {
  return canUseKnowledgeBase(user, planFlags);
}
