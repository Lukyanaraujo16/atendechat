import fs from "fs";
import path from "path";
import InventorySale from "../../../models/InventorySale";
import sequelize from "../../../database";
import UpdateInventorySalePaymentService from "../UpdateInventorySalePaymentService";
import UpdateInventorySaleService from "../UpdateInventorySaleService";
import CancelInventorySaleService from "../CancelInventorySaleService";
import { settlePaymentOnComplete } from "../inventoryPaymentHelpers";

function saleRecord(overrides: Record<string, unknown> = {}) {
  const sale: any = {
    id: 9,
    companyId: 4,
    status: "draft",
    paymentMethod: null,
    cardInstallmentCount: null,
    paymentStatus: "unpaid",
    paidAmount: 0,
    paidAt: null,
    totalAmount: 1000,
    paymentNotes: null,
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(sale, patch);
      return sale;
    }),
    reload: jest.fn(async () => sale)
  };
  Object.assign(sale, overrides);
  return sale;
}

describe("parcelas do cartão na conclusão", () => {
  it("cartão 1x e 18x ficam pagos pelo total, com paidAt preenchido", () => {
    const before = Date.now();
    const one = settlePaymentOnComplete({
      paymentMethod: "credit_card",
      cardInstallmentCount: 1,
      totalAmount: 1000,
      paidAmount: 0,
      existingPaidAt: null
    });
    const many = settlePaymentOnComplete({
      paymentMethod: "credit_card",
      cardInstallmentCount: 18,
      totalAmount: 1800,
      paidAmount: 0,
      existingPaidAt: null
    });
    const after = Date.now();

    expect(one).toMatchObject({ paymentStatus: "paid", paidAmount: 1000 });
    expect(many).toMatchObject({ paymentStatus: "paid", paidAmount: 1800 });
    expect(one.paidAt).toBeInstanceOf(Date);
    expect(many.paidAt).toBeInstanceOf(Date);
    expect((one.paidAt as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect((one.paidAt as Date).getTime()).toBeLessThanOrEqual(after);
  });

  it("preserva paidAt já gravado e não paga PIX automaticamente", () => {
    const existing = new Date("2026-01-02T00:00:00.000Z");
    const card = settlePaymentOnComplete({
      paymentMethod: "credit_card",
      cardInstallmentCount: 6,
      totalAmount: 300,
      paidAmount: 0,
      existingPaidAt: existing
    });
    const pix = settlePaymentOnComplete({
      paymentMethod: "pix",
      cardInstallmentCount: null,
      totalAmount: 300,
      paidAmount: 0,
      existingPaidAt: null
    });

    expect(card.paidAt).toBe(existing);
    expect(card.paidAmount).toBe(300);
    expect(pix).toEqual({
      paymentStatus: "unpaid",
      paidAmount: 0,
      paidAt: null
    });
  });

  it("recusa concluir cartão sem parcelas gravadas, inclusive NULL histórico", () => {
    let error: { message?: string; statusCode?: number } | null = null;
    try {
      settlePaymentOnComplete({
        paymentMethod: "credit_card",
        cardInstallmentCount: null,
        totalAmount: 100,
        paidAmount: 0,
        existingPaidAt: null
      });
    } catch (caught) {
      error = caught as { message?: string; statusCode?: number };
    }
    expect(error).toMatchObject({
      message: "ERR_VALIDATION_ERROR",
      statusCode: 400
    });
  });

  it("a conclusão usa o acerto e o resumo soma o valor pago uma vez", () => {
    const complete = fs.readFileSync(
      path.join(__dirname, "../CompleteInventorySaleService.ts"),
      "utf8"
    );
    const summary = fs.readFileSync(
      path.join(__dirname, "../GetInventoryReportSummaryService.ts"),
      "utf8"
    );
    expect(complete).toContain("settlePaymentOnComplete");
    expect(summary).not.toContain("cardInstallmentCount");
    expect(summary).toContain("paidAmount");
    expect(summary).toContain("totalPending");
  });
});

describe("UpdateInventorySalePaymentService parcelas", () => {
  const findSale = jest.spyOn(InventorySale, "findOne");

  beforeEach(() => {
    findSale.mockReset();
  });

  afterAll(() => {
    findSale.mockRestore();
  });

  async function save(
    sale: ReturnType<typeof saleRecord>,
    body: Record<string, unknown>
  ) {
    findSale.mockResolvedValue(sale);
    await UpdateInventorySalePaymentService({
      companyId: 4,
      saleId: 9,
      body
    });
    return sale.update.mock.calls[0][0];
  }

  it("aceita rascunho em cartão 1x e 18x sem marcar como pago", async () => {
    const one = await save(saleRecord(), {
      paymentStatus: "unpaid",
      paymentMethod: "credit_card",
      cardInstallmentCount: 1,
      companyId: 99
    });
    expect(one).toMatchObject({
      paymentMethod: "credit_card",
      cardInstallmentCount: 1,
      paymentStatus: "unpaid",
      paidAmount: 0,
      paidAt: null
    });
    expect(one).not.toHaveProperty("companyId");
    expect(findSale.mock.calls[0][0]).toMatchObject({
      where: { id: 9, companyId: 4 }
    });

    const eighteen = await save(saleRecord(), {
      paymentStatus: "unpaid",
      paymentMethod: "credit_card",
      cardInstallmentCount: 18
    });
    expect(eighteen.cardInstallmentCount).toBe(18);
    expect(eighteen.paymentStatus).toBe("unpaid");
    expect(eighteen.paidAmount).toBe(0);
  });

  it.each([0, -1, 19, 1.5, "6x", "abc", Number.NaN, true, null])(
    "recusa cartão com parcelas inválidas (%p)",
    async (cardInstallmentCount) => {
      const sale = saleRecord();
      findSale.mockResolvedValue(sale);
      await expect(
        UpdateInventorySalePaymentService({
          companyId: 4,
          saleId: 9,
          body: {
            paymentStatus: "unpaid",
            paymentMethod: "credit_card",
            cardInstallmentCount
          }
        })
      ).rejects.toMatchObject({
        message: "ERR_VALIDATION_ERROR",
        statusCode: 400
      });
      expect(sale.update).not.toHaveBeenCalled();
    }
  );

  it("não persiste PIX com parcelas e limpa ao sair do cartão", async () => {
    const pix = await save(saleRecord({ paymentMethod: "credit_card", cardInstallmentCount: 6 }), {
      paymentStatus: "unpaid",
      paymentMethod: "pix",
      cardInstallmentCount: 6
    });
    expect(pix.paymentMethod).toBe("pix");
    expect(pix.cardInstallmentCount).toBeNull();
    expect(pix.paymentStatus).toBe("unpaid");
    expect(pix.paidAmount).toBe(0);

    const cash = await save(saleRecord(), {
      paymentStatus: "unpaid",
      paymentMethod: "cash",
      cardInstallmentCount: 5
    });
    expect(cash.paymentMethod).toBe("cash");
    expect(cash.cardInstallmentCount).toBeNull();
  });

  it("exige parcelas ao configurar cartão novo e não inventa 1", async () => {
    const sale = saleRecord({ paymentMethod: "pix" });
    findSale.mockResolvedValue(sale);
    await expect(
      UpdateInventorySalePaymentService({
        companyId: 4,
        saleId: 9,
        body: {
          paymentStatus: "unpaid",
          paymentMethod: "credit_card"
        }
      })
    ).rejects.toMatchObject({ message: "ERR_VALIDATION_ERROR", statusCode: 400 });
    expect(sale.update).not.toHaveBeenCalled();
    expect(sale.cardInstallmentCount).toBeNull();
  });

  it("venda antiga de cartão sem parcelas continua gravada como NULL", async () => {
    const sale = saleRecord({
      status: "completed",
      paymentMethod: "credit_card",
      cardInstallmentCount: null,
      paymentStatus: "paid",
      paidAmount: 1000,
      totalAmount: 1000
    });
    const patch = await save(sale, {
      paymentStatus: "paid",
      paidAmount: 1000,
      paymentNotes: "consulta"
    });
    expect(patch).not.toHaveProperty("cardInstallmentCount");
    expect(patch).not.toHaveProperty("paymentMethod");
    expect(sale.cardInstallmentCount).toBeNull();
    expect(sale.paymentStatus).toBe("paid");
  });

  it("não encontra venda de outra empresa", async () => {
    findSale.mockResolvedValue(null);
    await expect(
      UpdateInventorySalePaymentService({
        companyId: 4,
        saleId: 9,
        body: {
          paymentStatus: "unpaid",
          paymentMethod: "credit_card",
          cardInstallmentCount: 2
        }
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_NOT_FOUND", statusCode: 404 });
    expect(findSale.mock.calls[0][0]).toMatchObject({
      where: { id: 9, companyId: 4 }
    });
  });

  it("o cabeçalho da venda não grava forma nem parcelas", async () => {
    const sale = saleRecord({ paymentMethod: "pix", cardInstallmentCount: null });
    findSale.mockResolvedValue(sale);
    await UpdateInventorySaleService({
      companyId: 4,
      id: 9,
      body: {
        notes: "só observação",
        paymentMethod: "credit_card",
        cardInstallmentCount: 10,
        companyId: 99
      } as any
    });
    expect(sale.update.mock.calls[0][0]).toEqual({ notes: "só observação" });
    expect(sale.paymentMethod).toBe("pix");
    expect(sale.cardInstallmentCount).toBeNull();
  });
});

describe("cancelamento e permissões com parcelas", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("cancelar rascunho não altera status financeiro nem parcelas", async () => {
    const sale = saleRecord({
      paymentMethod: "credit_card",
      cardInstallmentCount: 6,
      paymentStatus: "unpaid",
      paidAmount: 0
    });
    jest.spyOn(InventorySale, "findOne").mockResolvedValue(sale);
    jest.spyOn(sequelize, "transaction").mockImplementation(((fn: any) =>
      fn({ LOCK: { UPDATE: "UPDATE" } })) as any);

    await CancelInventorySaleService({
      companyId: 4,
      saleId: 9,
      cancelledBy: 3,
      cancelReason: "desistiu"
    });

    const patch = sale.update.mock.calls[0][0];
    expect(patch.status).toBe("cancelled");
    expect(patch.cancelReason).toBe("desistiu");
    expect(patch).not.toHaveProperty("paymentStatus");
    expect(patch).not.toHaveProperty("paidAmount");
    expect(patch).not.toHaveProperty("paymentMethod");
    expect(patch).not.toHaveProperty("cardInstallmentCount");
    expect(sale.cardInstallmentCount).toBe(6);
    expect(sale.paymentStatus).toBe("unpaid");
    expect(sale.paidAmount).toBe(0);
  });

  it("pagamento continua em managePayments e conclusão em createSale", () => {
    const routes = fs.readFileSync(
      path.join(__dirname, "../../../routes/inventoryRoutes.ts"),
      "utf8"
    );
    const updateAt = routes.indexOf('inventoryRoutes.put(\n  "/inventory/sales/:id"');
    const paymentAt = routes.indexOf('"/inventory/sales/:id/payment"');
    const completeAt = routes.indexOf('"/inventory/sales/:id/complete"');
    expect(updateAt).toBeGreaterThan(-1);
    expect(paymentAt).toBeGreaterThan(updateAt);
    expect(completeAt).toBeGreaterThan(-1);
    expect(routes.slice(updateAt, updateAt + 280)).toContain(
      "INVENTORY_SALES_CREATE_SALE"
    );
    expect(routes.slice(paymentAt - 180, paymentAt + 180)).toContain(
      "INVENTORY_SALES_MANAGE_PAYMENTS"
    );
    expect(routes.slice(completeAt - 180, completeAt + 120)).toContain(
      "INVENTORY_SALES_CREATE_SALE"
    );
    expect(routes).not.toContain("manageReceivables");
    expect(routes).not.toContain("store_credit");
  });
});
