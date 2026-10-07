/**
 * Orquestração do wizard de nova venda.
 * Etapas atuais: cliente → produtos → pagamento → conferência.
 * Extensível: inserir "delivery" entre products e payment sem redesign.
 */
export const SALE_WIZARD_STEP_IDS = {
  CUSTOMER: "customer",
  PRODUCTS: "products",
  // Futuro: DELIVERY: "delivery",
  PAYMENT: "payment",
  REVIEW: "review",
};

/** Ordem ativa. Quando frete existir, incluir delivery entre products e payment. */
export const SALE_WIZARD_ACTIVE_STEPS = [
  SALE_WIZARD_STEP_IDS.CUSTOMER,
  SALE_WIZARD_STEP_IDS.PRODUCTS,
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
