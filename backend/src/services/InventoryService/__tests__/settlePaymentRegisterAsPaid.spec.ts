import { settlePaymentOnComplete } from "../inventoryPaymentHelpers";

describe("settlePaymentOnComplete registerAsPaid", () => {
  const base = {
    cardInstallmentCount: null as number | null,
    totalAmount: 150,
    paidAmount: 0,
    existingPaidAt: null as Date | null
  };

  it.each([
    "cash",
    "pix",
    "debit_card",
    "bank_transfer"
  ] as const)("%s + registerAsPaid autorizado liquida pelo total", method => {
    const settled = settlePaymentOnComplete({
      ...base,
      paymentMethod: method,
      registerAsPaid: true,
      canManagePayments: true
    });
    expect(settled).toEqual({
      paymentStatus: "paid",
      paidAmount: 150,
      paidAt: expect.any(Date)
    });
  });

  it.each(["boleto", "other"] as const)(
    "%s default sem flag permanece unpaid",
    method => {
      const settled = settlePaymentOnComplete({
        ...base,
        paymentMethod: method,
        canManagePayments: true
      });
      expect(settled).toEqual({
        paymentStatus: "unpaid",
        paidAmount: 0,
        paidAt: null
      });
    }
  );

  it("boleto com registerAsPaid autorizado fica pago", () => {
    const settled = settlePaymentOnComplete({
      ...base,
      paymentMethod: "boleto",
      registerAsPaid: true,
      canManagePayments: true
    });
    expect(settled.paymentStatus).toBe("paid");
    expect(settled.paidAmount).toBe(150);
    expect(settled.paidAt).toBeInstanceOf(Date);
  });

  it("registerAsPaid false autorizado força unpaid", () => {
    const settled = settlePaymentOnComplete({
      ...base,
      paymentMethod: "pix",
      paidAmount: 150,
      registerAsPaid: false,
      canManagePayments: true
    });
    expect(settled).toEqual({
      paymentStatus: "unpaid",
      paidAmount: 0,
      paidAt: null
    });
  });

  it("sem managePayments ignora registerAsPaid forjado", () => {
    const settled = settlePaymentOnComplete({
      ...base,
      paymentMethod: "pix",
      registerAsPaid: true,
      canManagePayments: false
    });
    expect(settled).toEqual({
      paymentStatus: "unpaid",
      paidAmount: 0,
      paidAt: null
    });
  });

  it("cartão permanece sempre pago pelo total", () => {
    const settled = settlePaymentOnComplete({
      ...base,
      paymentMethod: "credit_card",
      cardInstallmentCount: 3,
      registerAsPaid: false,
      canManagePayments: true
    });
    expect(settled.paymentStatus).toBe("paid");
    expect(settled.paidAmount).toBe(150);
    expect(settled.paidAt).toBeInstanceOf(Date);
  });

  it("paidAmount não incrementa — define igual ao total", () => {
    const settled = settlePaymentOnComplete({
      ...base,
      paymentMethod: "cash",
      paidAmount: 40,
      registerAsPaid: true,
      canManagePayments: true
    });
    expect(settled.paidAmount).toBe(150);
  });

  it("comportamento antigo sem flag permanece", () => {
    const settled = settlePaymentOnComplete({
      ...base,
      paymentMethod: "pix",
      paidAmount: 0
    });
    expect(settled).toEqual({
      paymentStatus: "unpaid",
      paidAmount: 0,
      paidAt: null
    });
  });
});
