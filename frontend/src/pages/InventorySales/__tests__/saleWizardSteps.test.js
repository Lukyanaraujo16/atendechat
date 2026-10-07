import {
  SALE_WIZARD_ACTIVE_STEPS,
  SALE_WIZARD_STEP_IDS,
  nextSaleWizardStep,
  prevSaleWizardStep,
} from "../wizard/saleWizardSteps";

describe("saleWizardSteps", () => {
  it("ordem atual permite inserir delivery entre products e payment depois", () => {
    expect(SALE_WIZARD_ACTIVE_STEPS).toEqual([
      SALE_WIZARD_STEP_IDS.CUSTOMER,
      SALE_WIZARD_STEP_IDS.PRODUCTS,
      SALE_WIZARD_STEP_IDS.PAYMENT,
      SALE_WIZARD_STEP_IDS.REVIEW,
    ]);
    expect(nextSaleWizardStep(SALE_WIZARD_STEP_IDS.PRODUCTS)).toBe(
      SALE_WIZARD_STEP_IDS.PAYMENT
    );
    expect(prevSaleWizardStep(SALE_WIZARD_STEP_IDS.PAYMENT)).toBe(
      SALE_WIZARD_STEP_IDS.PRODUCTS
    );
  });
});
