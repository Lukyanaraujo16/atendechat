import {
  defaultRegisterAsPaid,
  isRegisterAsPaidLocked,
  resolveRegisterAsPaidForComplete,
} from "../wizard/paymentDefaults";

describe("paymentDefaults", () => {
  it.each(["cash", "pix", "debit_card", "bank_transfer", "credit_card"])(
    "%s default pago",
    (method) => {
      expect(defaultRegisterAsPaid(method)).toBe(true);
    }
  );

  it.each(["boleto", "other"])("%s default pendente", (method) => {
    expect(defaultRegisterAsPaid(method)).toBe(false);
  });

  it("cartão trava o checkbox e resolve sempre true", () => {
    expect(isRegisterAsPaidLocked("credit_card")).toBe(true);
    expect(resolveRegisterAsPaidForComplete("credit_card", false)).toBe(true);
  });

  it("boleto respeita o checkbox", () => {
    expect(resolveRegisterAsPaidForComplete("boleto", true)).toBe(true);
    expect(resolveRegisterAsPaidForComplete("boleto", false)).toBe(false);
  });
});
