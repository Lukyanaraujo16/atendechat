import AppError from "../../../errors/AppError";
import InventorySalePayment from "../../../models/InventorySalePayment";
import {
  applyLegacyAbsolutePayment,
  bootstrapLegacyPaymentsIfNeeded,
  syncDraftPaymentIntention,
  syncDraftPendingAfterTotalChange
} from "../inventorySalePaymentEngine";
import { calculateSalePaymentAggregate } from "../inventorySalePaymentAggregate";

type Row = {
  id: number;
  companyId: number;
  saleId: number;
  method: string;
  amount: number;
  status: string;
  paidAt: Date | string | null;
  notes: string | null;
  cardInstallmentCount: number | null;
  createdByUserId: number | null;
  update: jest.Mock;
  destroy: jest.Mock;
};

let store: Row[] = [];
let nextId = 1;
const tx = {} as any;

function makeSale(overrides: Record<string, unknown> = {}) {
  const sale: any = {
    id: 1,
    companyId: 10,
    status: "completed",
    totalAmount: 100,
    paymentStatus: "unpaid",
    paymentMethod: "cash",
    paidAmount: 0,
    paidAt: null,
    paymentNotes: null,
    cardInstallmentCount: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(sale, patch);
      return sale;
    })
  };
  Object.assign(sale, overrides);
  return sale;
}

function wrapRow(data: Omit<Row, "update" | "destroy" | "id"> & { id?: number }): Row {
  const row: Row = {
    id: data.id ?? nextId++,
    companyId: data.companyId,
    saleId: data.saleId,
    method: data.method,
    amount: data.amount,
    status: data.status,
    paidAt: data.paidAt,
    notes: data.notes,
    cardInstallmentCount: data.cardInstallmentCount,
    createdByUserId: data.createdByUserId,
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
  jest
    .spyOn(InventorySalePayment, "findAll")
    .mockImplementation(((opts: any) => {
      const { companyId, saleId } = opts.where;
      return Promise.resolve(
        store.filter(r => r.companyId === companyId && r.saleId === saleId)
      );
    }) as any);
  jest
    .spyOn(InventorySalePayment, "create")
    .mockImplementation(((data: any) => {
      const row = wrapRow({
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

describe("inventorySalePaymentEngine", () => {
  it("aggregate cases: empty / pending / paid / mix / overpay / cents / reversed", () => {
    expect(calculateSalePaymentAggregate(100, [])).toMatchObject({
      effectivePaid: 0,
      paymentStatus: "unpaid"
    });
    expect(
      calculateSalePaymentAggregate(100, [{ amount: 100, status: "pending" }])
    ).toMatchObject({ effectivePaid: 0, paymentStatus: "unpaid" });
    expect(
      calculateSalePaymentAggregate(100, [{ amount: 40, status: "paid" }])
    ).toMatchObject({
      effectivePaid: 40,
      paymentStatus: "partial",
      pendingAmount: 60
    });
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 40, status: "paid" },
        { amount: 60, status: "pending" }
      ])
    ).toMatchObject({ effectivePaid: 40, paymentStatus: "partial" });
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 40, status: "paid" },
        { amount: 60, status: "paid" }
      ])
    ).toMatchObject({ effectivePaid: 100, paymentStatus: "paid" });
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 100, status: "paid" },
        { amount: 20, status: "reversed" }
      ])
    ).toMatchObject({ effectivePaid: 100, paymentStatus: "paid" });
    expect(() =>
      calculateSalePaymentAggregate(100, [{ amount: 101, status: "paid" }])
    ).toThrow(AppError);
    expect(
      calculateSalePaymentAggregate(100, [
        { amount: 33.33, status: "paid" },
        { amount: 33.33, status: "paid" },
        { amount: 33.34, status: "paid" }
      ])
    ).toMatchObject({ effectivePaid: 100, paymentStatus: "paid" });
  });

  it("draft sem método → zero payments; com cash → pending total", async () => {
    const sale = makeSale({ status: "draft", paymentMethod: null, totalAmount: 100 });
    await syncDraftPaymentIntention(
      sale,
      { paymentMethod: null, cardInstallmentCount: null, paymentNotes: null },
      tx
    );
    expect(store).toHaveLength(0);

    const cache = await syncDraftPaymentIntention(
      sale,
      {
        paymentMethod: "cash",
        cardInstallmentCount: null,
        paymentNotes: "n",
        actorUserId: 7
      },
      tx
    );
    expect(cache).toMatchObject({
      paymentStatus: "unpaid",
      paidAmount: 0,
      paymentMethod: "cash"
    });
    expect(store).toHaveLength(1);
    expect(store[0]).toMatchObject({
      status: "pending",
      amount: 100,
      method: "cash",
      createdByUserId: 7
    });
  });

  it("draft muda cash→pix e total 100→110; nunca paid", async () => {
    const sale = makeSale({ status: "draft", totalAmount: 100 });
    await syncDraftPaymentIntention(
      sale,
      { paymentMethod: "cash", cardInstallmentCount: null, paymentNotes: null },
      tx
    );
    await syncDraftPaymentIntention(
      sale,
      { paymentMethod: "pix", cardInstallmentCount: null, paymentNotes: null },
      tx
    );
    expect(store).toHaveLength(1);
    expect(store[0]).toMatchObject({ method: "pix", amount: 100, status: "pending" });

    sale.totalAmount = 110;
    sale.paymentMethod = "pix";
    await syncDraftPendingAfterTotalChange(sale, tx);
    expect(store).toHaveLength(1);
    expect(store[0].amount).toBe(110);
    expect(store.every(r => r.status === "pending")).toBe(true);
  });

  it("draft cartão preserva installments; não-card zera", async () => {
    const sale = makeSale({ status: "draft", totalAmount: 200 });
    await syncDraftPaymentIntention(
      sale,
      {
        paymentMethod: "credit_card",
        cardInstallmentCount: 6,
        paymentNotes: null
      },
      tx
    );
    expect(store[0].cardInstallmentCount).toBe(6);
    await syncDraftPaymentIntention(
      sale,
      { paymentMethod: "pix", cardInstallmentCount: 6, paymentNotes: null },
      tx
    );
    expect(store[0]).toMatchObject({
      method: "pix",
      cardInstallmentCount: null
    });
  });

  it("PUT absoluto: 0→40→70→100 com pending reconciliado e histórico preservado", async () => {
    const sale = makeSale({
      status: "completed",
      paymentMethod: "cash",
      paymentStatus: "unpaid",
      paidAmount: 0,
      totalAmount: 100
    });

    let cache = await applyLegacyAbsolutePayment(
      sale,
      {
        targetPaidAmount: 0,
        paymentStatus: "unpaid",
        paymentMethod: "cash",
        cardInstallmentCount: null,
        paymentNotes: null,
        paidAt: null,
        actorUserId: 3
      },
      tx
    );
    expect(cache.paidAmount).toBe(0);
    expect(store).toEqual([
      expect.objectContaining({ status: "pending", amount: 100, method: "cash" })
    ]);

    cache = await applyLegacyAbsolutePayment(
      sale,
      {
        targetPaidAmount: 40,
        paymentStatus: "partial",
        paymentMethod: "cash",
        cardInstallmentCount: null,
        paymentNotes: "p1",
        paidAt: new Date("2026-03-01T00:00:00.000Z"),
        actorUserId: 3
      },
      tx
    );
    expect(cache).toMatchObject({ paidAmount: 40, paymentStatus: "partial" });
    expect(store.filter(r => r.status === "paid")).toEqual([
      expect.objectContaining({ amount: 40, notes: "p1" })
    ]);
    expect(store.filter(r => r.status === "pending")).toEqual([
      expect.objectContaining({ amount: 60 })
    ]);

    cache = await applyLegacyAbsolutePayment(
      sale,
      {
        targetPaidAmount: 70,
        paymentStatus: "partial",
        paymentMethod: "cash",
        cardInstallmentCount: null,
        paymentNotes: "p2",
        paidAt: new Date("2026-03-02T00:00:00.000Z"),
        actorUserId: 3
      },
      tx
    );
    expect(cache.paidAmount).toBe(70);
    const paid = store.filter(r => r.status === "paid");
    expect(paid).toHaveLength(2);
    expect(paid.map(p => p.amount).sort()).toEqual([30, 40]);
    expect(paid.find(p => p.amount === 40)?.notes).toBe("p1");
    expect(store.find(r => r.status === "pending")?.amount).toBe(30);

    cache = await applyLegacyAbsolutePayment(
      sale,
      {
        targetPaidAmount: 100,
        paymentStatus: "paid",
        paymentMethod: "cash",
        cardInstallmentCount: null,
        paymentNotes: "p3",
        paidAt: new Date("2026-03-03T00:00:00.000Z"),
        actorUserId: 3
      },
      tx
    );
    expect(cache).toMatchObject({ paidAmount: 100, paymentStatus: "paid" });
    expect(store.filter(r => r.status === "pending")).toHaveLength(0);
    expect(store.filter(r => r.status === "paid").map(p => p.amount).sort()).toEqual([
      30, 30, 40
    ]);
  });

  it("bloqueia overpayment, redução, troca de método pago e parcelas pagas", async () => {
    const sale = makeSale({
      status: "completed",
      paymentMethod: "cash",
      paymentStatus: "paid",
      paidAmount: 100,
      totalAmount: 100
    });
    store.push(
      wrapRow({
        companyId: 10,
        saleId: 1,
        method: "cash",
        amount: 100,
        status: "paid",
        paidAt: new Date(),
        notes: null,
        cardInstallmentCount: null,
        createdByUserId: null
      })
    );

    await expect(
      applyLegacyAbsolutePayment(
        sale,
        {
          targetPaidAmount: 110,
          paymentStatus: "paid",
          paymentMethod: "cash",
          cardInstallmentCount: null,
          paymentNotes: null,
          paidAt: new Date()
        },
        tx
      )
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_PAYMENT_OVERPAYMENT" });

    await expect(
      applyLegacyAbsolutePayment(
        sale,
        {
          targetPaidAmount: 40,
          paymentStatus: "partial",
          paymentMethod: "cash",
          cardInstallmentCount: null,
          paymentNotes: null,
          paidAt: new Date()
        },
        tx
      )
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_PAYMENT_REDUCTION_FORBIDDEN"
    });

    await expect(
      applyLegacyAbsolutePayment(
        sale,
        {
          targetPaidAmount: 100,
          paymentStatus: "paid",
          paymentMethod: "pix",
          cardInstallmentCount: null,
          paymentNotes: null,
          paidAt: new Date()
        },
        tx
      )
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_PAYMENT_METHOD_LOCKED"
    });

    store = [
      wrapRow({
        companyId: 10,
        saleId: 1,
        method: "credit_card",
        amount: 100,
        status: "paid",
        paidAt: new Date(),
        notes: null,
        cardInstallmentCount: 6,
        createdByUserId: null
      })
    ];
    sale.paymentMethod = "credit_card";
    sale.cardInstallmentCount = 6;
    await expect(
      applyLegacyAbsolutePayment(
        sale,
        {
          targetPaidAmount: 100,
          paymentStatus: "paid",
          paymentMethod: "credit_card",
          cardInstallmentCount: 3,
          paymentNotes: null,
          paidAt: new Date()
        },
        tx
      )
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_PAYMENT_INSTALLMENTS_LOCKED"
    });
  });

  it("pending unpaid permite trocar método e parcelas", async () => {
    const sale = makeSale({
      status: "completed",
      paymentMethod: "cash",
      paymentStatus: "unpaid",
      paidAmount: 0
    });
    store.push(
      wrapRow({
        companyId: 10,
        saleId: 1,
        method: "cash",
        amount: 100,
        status: "pending",
        paidAt: null,
        notes: null,
        cardInstallmentCount: null,
        createdByUserId: null
      })
    );

    await applyLegacyAbsolutePayment(
      sale,
      {
        targetPaidAmount: 0,
        paymentStatus: "unpaid",
        paymentMethod: "pix",
        cardInstallmentCount: null,
        paymentNotes: null,
        paidAt: null
      },
      tx
    );
    expect(store).toEqual([
      expect.objectContaining({ method: "pix", status: "pending", amount: 100 })
    ]);

    await applyLegacyAbsolutePayment(
      sale,
      {
        targetPaidAmount: 0,
        paymentStatus: "unpaid",
        paymentMethod: "credit_card",
        cardInstallmentCount: 4,
        paymentNotes: null,
        paidAt: null
      },
      tx
    );
    expect(store[0]).toMatchObject({
      method: "credit_card",
      cardInstallmentCount: 4,
      status: "pending"
    });
  });

  it("bootstrap legado sem lines; refunded bloqueia; idempotente", async () => {
    const paidSale = makeSale({
      paymentStatus: "paid",
      paymentMethod: "pix",
      paidAmount: 100,
      totalAmount: 100,
      paidAt: "2026-04-01T00:00:00.000Z"
    });
    const once = await bootstrapLegacyPaymentsIfNeeded(paidSale, tx, null);
    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({ status: "paid", amount: 100, method: "pix" });
    const twice = await bootstrapLegacyPaymentsIfNeeded(paidSale, tx, null);
    expect(twice).toHaveLength(1);

    const partial = makeSale({
      id: 2,
      paymentStatus: "partial",
      paymentMethod: "cash",
      paidAmount: 40,
      totalAmount: 100
    });
    const partLines = await bootstrapLegacyPaymentsIfNeeded(partial, tx, null);
    expect(partLines).toEqual([
      expect.objectContaining({ status: "paid", amount: 40 })
    ]);

    const unpaid = makeSale({
      id: 3,
      paymentStatus: "unpaid",
      paymentMethod: "boleto",
      paidAmount: 0,
      totalAmount: 80
    });
    const pending = await bootstrapLegacyPaymentsIfNeeded(unpaid, tx, null);
    expect(pending).toEqual([
      expect.objectContaining({ status: "pending", amount: 80, method: "boleto" })
    ]);

    const noMethod = makeSale({
      id: 4,
      paymentStatus: "unpaid",
      paymentMethod: null,
      paidAmount: 0
    });
    expect(await bootstrapLegacyPaymentsIfNeeded(noMethod, tx, null)).toEqual([]);

    const refunded = makeSale({
      id: 5,
      paymentStatus: "refunded",
      paymentMethod: "cash",
      paidAmount: 0
    });
    await expect(
      bootstrapLegacyPaymentsIfNeeded(refunded, tx, null)
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_PAYMENT_REFUNDED_UNSUPPORTED"
    });
  });

  it("tenant isolation: list só companyId+saleId", async () => {
    store.push(
      wrapRow({
        companyId: 10,
        saleId: 1,
        method: "cash",
        amount: 50,
        status: "paid",
        paidAt: new Date(),
        notes: null,
        cardInstallmentCount: null,
        createdByUserId: null
      }),
      wrapRow({
        companyId: 99,
        saleId: 1,
        method: "pix",
        amount: 50,
        status: "paid",
        paidAt: new Date(),
        notes: null,
        cardInstallmentCount: null,
        createdByUserId: null
      })
    );
    const sale = makeSale({ companyId: 10, id: 1, paymentStatus: "partial", paidAmount: 50 });
    const cache = await applyLegacyAbsolutePayment(
      sale,
      {
        targetPaidAmount: 50,
        paymentStatus: "partial",
        paymentMethod: "cash",
        cardInstallmentCount: null,
        paymentNotes: null,
        paidAt: new Date()
      },
      tx
    );
    expect(cache.paidAmount).toBe(50);
    expect(InventorySalePayment.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 10, saleId: 1 }
      })
    );
  });

  it("cancelled e refunded no apply são bloqueados", async () => {
    await expect(
      applyLegacyAbsolutePayment(
        makeSale({ status: "cancelled" }),
        {
          targetPaidAmount: 0,
          paymentStatus: "unpaid",
          paymentMethod: "cash",
          cardInstallmentCount: null,
          paymentNotes: null,
          paidAt: null
        },
        tx
      )
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_PAYMENT_CANCELLED" });

    await expect(
      applyLegacyAbsolutePayment(
        makeSale({ status: "completed" }),
        {
          targetPaidAmount: 0,
          paymentStatus: "refunded",
          paymentMethod: "cash",
          cardInstallmentCount: null,
          paymentNotes: null,
          paidAt: null
        },
        tx
      )
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_PAYMENT_REFUNDED_UNSUPPORTED"
    });
  });

  it("frete no total: paid 110 em total 110", async () => {
    const sale = makeSale({
      totalAmount: 110,
      paymentMethod: "pix",
      paymentStatus: "unpaid",
      paidAmount: 0
    });
    const cache = await applyLegacyAbsolutePayment(
      sale,
      {
        targetPaidAmount: 110,
        paymentStatus: "paid",
        paymentMethod: "pix",
        cardInstallmentCount: null,
        paymentNotes: null,
        paidAt: new Date(),
        actorUserId: 9
      },
      tx
    );
    expect(cache).toMatchObject({ paidAmount: 110, paymentStatus: "paid" });
    expect(store.filter(r => r.status === "paid")[0].createdByUserId).toBe(9);
  });
});
