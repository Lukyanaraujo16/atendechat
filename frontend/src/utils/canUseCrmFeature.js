/**
 * CRM no painel do ticket: plano ativo e utilizador não bloqueado explicitamente.
 * Alinhado a TicketActionButtonsCustom (showCrmSlot).
 */
export function canUseCrmFeature(user, planFlags) {
  const fx = planFlags?.effectiveFeatures || {};
  const planOn = fx["crm.pipeline"] === true;
  if (!planOn && planFlags?.ready) {
    return false;
  }
  if (user?.effectiveUserFeatures?.["crm.pipeline"] === false) {
    return false;
  }
  if (!planFlags?.ready) {
    return planOn !== false;
  }
  return planOn;
}
