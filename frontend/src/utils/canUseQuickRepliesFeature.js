/**
 * Respostas rápidas no composer (autocomplete / modal).
 * Feature: automation.quick_replies (plano + permissão individual).
 */
export function canUseQuickRepliesFeature(user, planFlags) {
  const fx = planFlags?.effectiveFeatures || {};
  const planOn = fx["automation.quick_replies"] === true;
  if (!planOn && planFlags?.ready) {
    return false;
  }
  if (user?.effectiveUserFeatures?.["automation.quick_replies"] === false) {
    return false;
  }
  if (!planFlags?.ready) {
    return planOn !== false;
  }
  return planOn;
}
