import { planInventorySalePaymentBackfill } from "../inventorySalePaymentBackfill";

function sale(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyId: 10,
    paymentStatus: "unpaid",
    paymentMethod: null as string | null,
    paidAmount: 0,
    totalAmount: 100,
    paidAt: null as Date | string | null,
    paymentNotes: null as string | null,
    cardInstallmentCount: null as number | null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides
  };
}

describe("planInventorySalePaymentBackfill", () => {
  it("paid cash coerente", () => {
    const plan = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "paid",
        paymentMethod: "cash",
        paidAmount: 100,
        totalAmount: 100,
        paidAt: "2026-02-01T12:00:00.000Z",
        paymentNotes: "ok"
      })
    );
    expect(plan.action).toBe("create");
    if (plan.action === "create") {
      expect(plan.payment).toMatchObject({
        companyId: 10,
        saleId: 1,
        method: "cash",
        amount: 100,
        status: "paid",
        paidAt: "2026-02-01T12:00:00.000Z",
        notes: "ok",
        cardInstallmentCount: null,
        createdByUserId: null
      });
    }
  });

  it("paid pix e credit_card 6x", () => {
    const pix = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "paid",
        paymentMethod: "pix",
        paidAmount: 50,
        totalAmount: 50
      })
    );
    expect(pix.action).toBe("create");
    if (pix.action === "create") {
      expect(pix.payment.method).toBe("pix");
      expect(pix.payment.cardInstallmentCount).toBeNull();
    }

    const card = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "paid",
        paymentMethod: "credit_card",
        paidAmount: 600,
        totalAmount: 600,
        cardInstallmentCount: 6
      })
    );
    expect(card.action).toBe("create");
    if (card.action === "create") {
      expect(card.payment.cardInstallmentCount).toBe(6);
      expect(card.payment.amount).toBe(600);
    }
  });

  it("partial cria unpaid restante NÃO; unpaid+method cria pending no total", () => {
    const partial = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "partial",
        paymentMethod: "cash",
        paidAmount: 40,
        totalAmount: 100
      })
    );
    expect(partial.action).toBe("create");
    if (partial.action === "create") {
      expect(partial.payment).toMatchObject({
        status: "paid",
        amount: 40,
        method: "cash"
      });
    }

    const unpaidCash = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "unpaid",
        paymentMethod: "cash",
        paidAmount: 0,
        totalAmount: 39.9
      })
    );
    expect(unpaidCash.action).toBe("create");
    if (unpaidCash.action === "create") {
      expect(unpaidCash.payment).toMatchObject({
        status: "pending",
        amount: 39.9,
        paidAt: null,
        method: "cash"
      });
    }

    const unpaidBoleto = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "unpaid",
        paymentMethod: "boleto",
        paidAmount: 0,
        totalAmount: 200
      })
    );
    expect(unpaidBoleto.action).toBe("create");
    if (unpaidBoleto.action === "create") {
      expect(unpaidBoleto.payment.status).toBe("pending");
      expect(unpaidBoleto.payment.amount).toBe(200);
    }
  });

  it("unpaid sem método / refunded / inconsistências → skip", () => {
    expect(
      planInventorySalePaymentBackfill(
        sale({ paymentStatus: "unpaid", paymentMethod: null })
      ).action
    ).toBe("skip");

    expect(
      planInventorySalePaymentBackfill(
        sale({
          paymentStatus: "refunded",
          paymentMethod: "cash",
          paidAmount: 0
        })
      )
    ).toMatchObject({ action: "skip", reason: "refunded_no_reliable_history" });

    expect(
      planInventorySalePaymentBackfill(
        sale({
          paymentStatus: "paid",
          paymentMethod: "cash",
          paidAmount: 0,
          totalAmount: 100
        })
      ).action
    ).toBe("skip");

    expect(
      planInventorySalePaymentBackfill(
        sale({
          paymentStatus: "paid",
          paymentMethod: "cash",
          paidAmount: 90,
          totalAmount: 100
        })
      ).action
    ).toBe("skip");

    expect(
      planInventorySalePaymentBackfill(
        sale({
          paymentStatus: "partial",
          paymentMethod: "cash",
          paidAmount: 0
        })
      ).action
    ).toBe("skip");

    expect(
      planInventorySalePaymentBackfill(
        sale({
          paymentStatus: "partial",
          paymentMethod: "cash",
          paidAmount: 100,
          totalAmount: 100
        })
      ).action
    ).toBe("skip");

    expect(
      planInventorySalePaymentBackfill(
        sale({
          paymentStatus: "unpaid",
          paymentMethod: "pix",
          paidAmount: 10
        })
      ).action
    ).toBe("skip");

    expect(
      planInventorySalePaymentBackfill(
        sale({
          paymentStatus: "paid",
          paymentMethod: null,
          paidAmount: 50
        })
      ).action
    ).toBe("skip");
  });

  it("cartão sem installments preserva null; inválido vira null sem skip do payment", () => {
    const nullInst = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "paid",
        paymentMethod: "credit_card",
        paidAmount: 100,
        totalAmount: 100,
        cardInstallmentCount: null
      })
    );
    expect(nullInst.action).toBe("create");
    if (nullInst.action === "create") {
      expect(nullInst.payment.cardInstallmentCount).toBeNull();
    }

    const invalid = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "paid",
        paymentMethod: "credit_card",
        paidAmount: 100,
        totalAmount: 100,
        cardInstallmentCount: 99
      })
    );
    expect(invalid.action).toBe("create");
    if (invalid.action === "create") {
      expect(invalid.payment.cardInstallmentCount).toBeNull();
    }
  });

  it("freight embutido no total: usa paidAmount, não recalcula", () => {
    const plan = planInventorySalePaymentBackfill(
      sale({
        paymentStatus: "paid",
        paymentMethod: "pix",
        paidAmount: 120,
        totalAmount: 120
      })
    );
    expect(plan.action).toBe("create");
    if (plan.action === "create") {
      expect(plan.payment.amount).toBe(120);
    }
  });

  it("tenant fields preservados; createdBy null; paidAt histórico null permitido", () => {
    const plan = planInventorySalePaymentBackfill(
      sale({
        id: 77,
        companyId: 3,
        paymentStatus: "paid",
        paymentMethod: "cash",
        paidAmount: 10,
        totalAmount: 10,
        paidAt: null
      })
    );
    expect(plan.action).toBe("create");
    if (plan.action === "create") {
      expect(plan.payment.companyId).toBe(3);
      expect(plan.payment.saleId).toBe(77);
      expect(plan.payment.createdByUserId).toBeNull();
      expect(plan.payment.paidAt).toBeNull();
    }
  });
});
