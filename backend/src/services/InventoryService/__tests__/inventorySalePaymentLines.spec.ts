import AppError from "../../../errors/AppError";
import InventorySale from "../../../models/InventorySale";
import InventorySalePayment from "../../../models/InventorySalePayment";
import sequelize from "../../../database";
import {
  addInventorySalePayment,
  deletePendingInventorySalePayment,
  settleInventorySalePayment,
  updatePendingInventorySalePayment
} from "../InventorySalePaymentLinesService";
import {
  assertSaleTotalSupportsPayments,
  buildPaymentFinancialSummary,
  deriveLegacyPaymentCache
} from "../inventorySalePaymentEngine";
import { calculateSalePaymentAggregate } from "../inventorySalePaymentAggregate";

type Row = {
  id: number;
  companyId: number;
  saleId: number;
  method: string;
  amount: number;
  status: string;
  paidAt: Date | null;
  notes: string | null;
  cardInstallmentCount: number | null;
  createdByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
  update: jest.Mock;
  destroy: jest.Mock;
};

let store: Row[] = [];
let nextId = 1;

function makeSale(overrides: Record<string, unknown> = {}) {
  const sale: any = {
    id: 1,
    companyId: 10,
    status: "draft",
    totalAmount: 1000,
    paymentStatus: "unpaid",
    paymentMethod: null,
    paidAmount: 0,
    paidAt: null,
    paymentNotes: null,
    cardInstallmentCount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(sale, patch);
      return sale;
    })
  };
  Object.assign(sale, overrides);
  return sale;
}

function wrap(data: Partial<Row> & { method: string; amount: number; status: string }): Row {
  const row: Row = {
    id: data.id ?? nextId++,
    companyId: data.companyId ?? 10,
    saleId: data.saleId ?? 1,
    method: data.method,
    amount: data.amount,
    status: data.status,
    paidAt: data.paidAt ?? null,
    notes: data.notes ?? null,
    cardInstallmentCount: data.cardInstallmentCount ?? null,
    createdByUserId: data.createdByUserId ?? null,
    createdAt: data.createdAt ?? new Date(),
    updatedAt: data.updatedAt ?? new Date(),
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(row, patch);
      return row;
    }),
    destroy: jest.fn(async () => {
      store = store.filter(r => r.id !== row.id);
    })
  };
  return row;
}

beforeEach(() => {
  store = [];
  nextId = 1;
  jest.spyOn(sequelize, "transaction").mockImplementation(((fn: any) =>
    fn({ LOCK: { UPDATE: "UPDATE" } })) as any);
  jest.spyOn(InventorySale, "findOne").mockImplementation((() =>
    Promise.resolve(makeSale())) as any);
  jest
    .spyOn(InventorySalePayment, "findAll")
    .mockImplementation(((opts: any) => {
      const { companyId, saleId } = opts.where;
      return Promise.resolve(
        store.filter(r => r.companyId === companyId && r.saleId === saleId)
      );
    }) as any);
  jest
    .spyOn(InventorySalePayment, "findOne")
    .mockImplementation(((opts: any) => {
      const { id, companyId, saleId } = opts.where;
      return Promise.resolve(
        store.find(
          r => r.id === id && r.companyId === companyId && r.saleId === saleId
        ) || null
      );
    }) as any);
  jest
    .spyOn(InventorySalePayment, "create")
    .mockImplementation(((data: any) => {
      const row = wrap({
        companyId: data.companyId,
        saleId: data.saleId,
        method: data.method,
        amount: Number(data.amount),
        status: data.status,
        paidAt: data.paidAt ?? null,
        notes: data.notes ?? null,
        cardInstallmentCount: data.cardInstallmentCount ?? null,
        createdByUserId: data.createdByUserId ?? null
      });
      store.push(row);
      return Promise.resolve(row);
    }) as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("InventorySalePaymentLinesService", () => {
  it("split 200 cash + 300 pix + 500 card 5x → paid 1000", async () => {
    await addInventorySalePayment({
      companyId: 10,
      saleId: 1,
      actorUserId: 3,
      body: { method: "cash", amount: 200, status: "paid" }
    });
    await addInventorySalePayment({
      companyId: 10,
      saleId: 1,
      actorUserId: 3,
      body: { method: "pix", amount: 300, status: "paid" }
    });
    const final = await addInventorySalePayment({
      companyId: 10,
      saleId: 1,
      actorUserId: 3,
      body: {
        method: "credit_card",
        amount: 500,
        status: "paid",
        cardInstallmentCount: 5
      }
    });
    expect(final.summary).toMatchObject({
      effectivePaid: 1000,
      pendingAmount: 0,
      remainingToAllocate: 0,
      paymentStatus: "paid"
    });
    expect(final.payments).toHaveLength(3);
    expect(final.payments[2].cardInstallmentCount).toBe(5);
  });

  it("cash paid 200 + boleto pending 800 → partial / allocate 0", async () => {
    await addInventorySalePayment({
      companyId: 10,
      saleId: 1,
      actorUserId: 3,
      body: { method: "cash", amount: 200, status: "paid" }
    });
    const bundle = await addInventorySalePayment({
      companyId: 10,
      saleId: 1,
      actorUserId: 3,
      body: { method: "boleto", amount: 800, status: "pending" }
    });
    expect(bundle.summary).toMatchObject({
      effectivePaid: 200,
      pendingAmount: 800,
      remainingToAllocate: 0,
      paymentStatus: "partial"
    });
  });

  it("rejeita amount zero, overpayment e overallocation", async () => {
    await expect(
      addInventorySalePayment({
        companyId: 10,
        saleId: 1,
        actorUserId: 1,
        body: { method: "cash", amount: 0, status: "paid" }
      })
    ).rejects.toBeInstanceOf(AppError);

    await addInventorySalePayment({
      companyId: 10,
      saleId: 1,
      actorUserId: 1,
      body: { method: "cash", amount: 700, status: "paid" }
    });
    await expect(
      addInventorySalePayment({
        companyId: 10,
        saleId: 1,
        actorUserId: 1,
        body: { method: "pix", amount: 400, status: "paid" }
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_PAYMENT_OVERPAYMENT" });

    store = [
      wrap({ method: "cash", amount: 700, status: "paid" }),
      wrap({ method: "boleto", amount: 300, status: "pending" })
    ];
    await expect(
      addInventorySalePayment({
        companyId: 10,
        saleId: 1,
        actorUserId: 1,
        body: { method: "pix", amount: 10, status: "pending" }
      })
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_PAYMENT_OVERALLOCATION"
    });
  });

  it("pending delete/edit/settle; paid imutável", async () => {
    await addInventorySalePayment({
      companyId: 10,
      saleId: 1,
      actorUserId: 2,
      body: { method: "boleto", amount: 500, status: "pending" }
    });
    const pendingId = store[0].id;

    await updatePendingInventorySalePayment({
      companyId: 10,
      saleId: 1,
      paymentId: pendingId,
      actorUserId: 2,
      body: { method: "boleto", amount: 400 }
    });
    expect(store[0].amount).toBe(400);

    const settled = await settleInventorySalePayment({
      companyId: 10,
      saleId: 1,
      paymentId: pendingId,
      actorUserId: 2,
      body: {}
    });
    expect(settled.payments[0].status).toBe("paid");
    expect(settled.summary.effectivePaid).toBe(400);

    await expect(
      deletePendingInventorySalePayment({
        companyId: 10,
        saleId: 1,
        paymentId: pendingId
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_PAYMENT_IMMUTABLE" });

    await addInventorySalePayment({
      companyId: 10,
      saleId: 1,
      actorUserId: 2,
      body: { method: "cash", amount: 100, status: "pending" }
    });
    const pending2 = store.find(r => r.status === "pending")!.id;
    await deletePendingInventorySalePayment({
      companyId: 10,
      saleId: 1,
      paymentId: pending2
    });
    expect(store.every(r => r.status !== "pending")).toBe(true);
  });

  it("cache multi-method → paymentMethod null; unique card preserves installments", () => {
    const multi = [
      wrap({ method: "cash", amount: 200, status: "paid" }),
      wrap({ method: "pix", amount: 800, status: "paid" })
    ];
    const agg = calculateSalePaymentAggregate(1000, multi);
    expect(deriveLegacyPaymentCache(multi as any, agg).paymentMethod).toBeNull();

    const card = [
      wrap({
        method: "credit_card",
        amount: 1000,
        status: "paid",
        cardInstallmentCount: 6
      })
    ];
    const cardAgg = calculateSalePaymentAggregate(1000, card);
    expect(deriveLegacyPaymentCache(card as any, cardAgg)).toMatchObject({
      paymentMethod: "credit_card",
      cardInstallmentCount: 6
    });
  });

  it("assertSaleTotalSupportsPayments bloqueia redução abaixo da alocação", () => {
    const lines = [
      { amount: 400, status: "paid" },
      { amount: 600, status: "pending" }
    ];
    expect(() => assertSaleTotalSupportsPayments(90, lines)).toThrow(AppError);
    expect(() => assertSaleTotalSupportsPayments(1000, lines)).not.toThrow();
    expect(buildPaymentFinancialSummary(1200, lines).remainingToAllocate).toBe(
      200
    );
  });

  it("cancelled bloqueia mutation", async () => {
    (InventorySale.findOne as jest.Mock).mockResolvedValue(
      makeSale({ status: "cancelled" })
    );
    await expect(
      addInventorySalePayment({
        companyId: 10,
        saleId: 1,
        actorUserId: 1,
        body: { method: "cash", amount: 10, status: "paid" }
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_PAYMENT_CANCELLED" });
  });
});
