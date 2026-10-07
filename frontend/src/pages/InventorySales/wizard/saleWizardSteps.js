/**
 * Orquestração do wizard de nova venda.
 * Etapas: cliente → produtos → entrega → pagamento → conferência.
 */
export const SALE_WIZARD_STEP_IDS = {
  CUSTOMER: "customer",
  PRODUCTS: "products",
  DELIVERY: "delivery",
  PAYMENT: "payment",
  REVIEW: "review",
};

/** Ordem ativa — navegação via next/prevSaleWizardStep (sem hardcode). */
export const SALE_WIZARD_ACTIVE_STEPS = [
  SALE_WIZARD_STEP_IDS.CUSTOMER,
  SALE_WIZARD_STEP_IDS.PRODUCTS,
  SALE_WIZARD_STEP_IDS.DELIVERY,
  SALE_WIZARD_STEP_IDS.PAYMENT,
  SALE_WIZARD_STEP_IDS.REVIEW,
];

export function saleWizardStepIndex(stepId) {
  return SALE_WIZARD_ACTIVE_STEPS.indexOf(stepId);
}

export function saleWizardStepAt(index) {
  if (index < 0 || index >= SALE_WIZARD_ACTIVE_STEPS.length) return null;
  return SALE_WIZARD_ACTIVE_STEPS[index];
}

export function nextSaleWizardStep(stepId) {
  const idx = saleWizardStepIndex(stepId);
  if (idx < 0) return null;
  return saleWizardStepAt(idx + 1);
}

export function prevSaleWizardStep(stepId) {
  const idx = saleWizardStepIndex(stepId);
  if (idx <= 0) return null;
  return saleWizardStepAt(idx - 1);
}
