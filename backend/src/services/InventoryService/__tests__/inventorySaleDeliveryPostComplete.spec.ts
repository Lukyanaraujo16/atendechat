import AppError from "../../../errors/AppError";
import InventoryDeliveryMethod from "../../../models/InventoryDeliveryMethod";
import InventorySale from "../../../models/InventorySale";
import InventorySaleDelivery from "../../../models/InventorySaleDelivery";
import InventorySaleItem from "../../../models/InventorySaleItem";
import InventorySalePayment from "../../../models/InventorySalePayment";
import sequelize from "../../../database";
import UpdateInventorySaleDeliveryService from "../UpdateInventorySaleDeliveryService";
import { assertCompletedSaleTotalAgainstPayments } from "../inventorySalePaymentEngine";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(
      async (cb: (t: { LOCK: { UPDATE: string } }) => Promise<unknown>) =>
        cb({ LOCK: { UPDATE: "UPDATE" } })
    )
  }
}));

jest.mock("../../../models/InventoryDeliveryMethod", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/InventorySale", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn() }
}));

jest.mock("../../../models/InventorySaleDelivery", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));

jest.mock("../../../models/InventorySaleItem", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../../../models/InventorySalePayment", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), create: jest.fn() }
}));

jest.mock("../../../models/Contact", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/Ticket", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/User", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/InventoryProduct", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../models/InventorySaleItemIdentifier", () => ({
  __esModule: true,
  default: {}
}));

const methodFindOne = InventoryDeliveryMethod.findOne as jest.Mock;
const saleFindOne = InventorySale.findOne as jest.Mock;
const saleUpdate = InventorySale.update as jest.Mock;
const deliveryFindOne = InventorySaleDelivery.findOne as jest.Mock;
const deliveryCreate = InventorySaleDelivery.create as jest.Mock;
const itemFindAll = InventorySaleItem.findAll as jest.Mock;
const paymentFindAll = InventorySalePayment.findAll as jest.Mock;

function methodRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    companyId: 1,
    name: "Motoboy",
    kind: "courier",
    defaultAmount: 20,
    allowAmountOverride: true,
    requiresAddress: true,
    active: true,
    ...overrides
  };
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyId: 1,
    saleId: 50,
    method: "cash",
    amount: 100,
    status: "paid",
    cardInstallmentCount: null,
    paidAt: new Date(),
    notes: null,
    update: jest.fn(async function update(this: any, patch: Record<string, unknown>) {
      Object.assign(this, patch);
      return this;
    }),
    destroy: jest.fn(),
    ...overrides
  };
}

function completedSale(overrides: Record<string, unknown> = {}) {
  const merchandise = Number(overrides.merchandise ?? 100);
  const freight = Number(
    overrides.freightAmount != null ? overrides.freightAmount : 20
  );
  const sale: any = {
    id: 50,
    companyId: 1,
    status: "completed",
    freightAmount: freight,
    deliveryMethodId: 11,
    deliveryMethodName: "Motoboy",
    deliveryKind: "courier",
    paymentStatus: "paid",
    paidAmount: 120,
    paymentMethod: "cash",
    paidAt: new Date(),
    paymentNotes: null,
    cardInstallmentCount: null,
    commissionAmount: 5,
    commissionRate: 5,
    subtotalAmount: merchandise,
    discountAmount: 0,
    totalAmount: merchandise + freight,
    contactId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(sale, patch);
      return sale;
    }),
    reload: jest.fn(async () => {
      // Simula DB após recalculateInventorySaleTotals
      const merch = merchandise;
      sale.totalAmount = merch + Number(sale.freightAmount || 0);
      return sale;
    })
  };
  Object.assign(sale, overrides);
  // merchandise helper is not a sale field
  delete sale.merchandise;
  return sale;
}

const address = {
  recipientName: "Ana",
  recipientPhone: "11999999999",
  street: "Rua A",
  number: "10",
  district: "Centro",
  city: "São Paulo",
  state: "SP"
};

async function runDelivery(
  sale: any,
  body: Record<string, unknown>,
  method = methodRecord()
) {
  saleFindOne.mockResolvedValue(sale);
  methodFindOne.mockResolvedValue(method);
  deliveryFindOne.mockResolvedValue(null);
  deliveryCreate.mockResolvedValue({});
  itemFindAll.mockResolvedValue([
    {
      unitPrice: 100,
      quantity: 1,
      discountAmount: 0,
      totalAmount: 100,
      update: jest.fn()
    }
  ]);
  saleUpdate.mockImplementation(async (patch: Record<string, unknown>) => {
    Object.assign(sale, patch);
    return [1];
  });
  // findOne after transaction + reload with includes
  saleFindOne
    .mockResolvedValueOnce(sale)
    .mockResolvedValueOnce(sale);
  return UpdateInventorySaleDeliveryService({
    companyId: 1,
    saleId: 50,
    body: { deliveryMethodId: method.id, recipient: address, ...body }
  });
}

describe("assertCompletedSaleTotalAgainstPayments", () => {
  it("permite total >= paid e allocation", () => {
    expect(() =>
      assertCompletedSaleTotalAgainstPayments(90, [
        { amount: 60, status: "paid" }
      ])
    ).not.toThrow();
    expect(() =>
      assertCompletedSaleTotalAgainstPayments(90, [
        { amount: 20, status: "paid" },
        { amount: 30, status: "pending" }
      ])
    ).not.toThrow();
  });

  it("bloqueia abaixo do recebido", () => {
    try {
      assertCompletedSaleTotalAgainstPayments(90, [
        { amount: 100, status: "paid" }
      ]);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).toBe("ERR_INVENTORY_SALE_TOTAL_BELOW_PAID");
    }
  });

  it("bloqueia allocation com pending sem tocar paid", () => {
    try {
      assertCompletedSaleTotalAgainstPayments(90, [
        { amount: 20, status: "paid" },
        { amount: 80, status: "pending" }
      ]);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).toBe(
        "ERR_INVENTORY_SALE_TOTAL_BELOW_ALLOCATION"
      );
    }
  });
});

describe("UpdateInventorySaleDeliveryService pós-complete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paymentFindAll.mockResolvedValue([]);
  });

  it("cancelled bloqueia; draft continua permitido", async () => {
    const cancelled = completedSale({ status: "cancelled" });
    saleFindOne.mockResolvedValue(cancelled);
    await expect(
      UpdateInventorySaleDeliveryService({
        companyId: 1,
        saleId: 50,
        body: { deliveryMethodId: 11 }
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_ALREADY_CANCELLED" });
  });

  it("aumento de frete: paid → partial; lines intactas; commission intacta", async () => {
    const sale = completedSale({
      freightAmount: 0,
      totalAmount: 100,
      paidAmount: 100,
      paymentStatus: "paid",
      commissionAmount: 5
    });
    const paidLine = paymentRow({ amount: 100, status: "paid" });
    paymentFindAll.mockResolvedValue([paidLine]);

    await runDelivery(sale, { freightAmount: 20 }, methodRecord({ defaultAmount: 20 }));

    expect(sale.freightAmount).toBe(20);
    expect(sale.totalAmount).toBe(120);
    expect(sale.paidAmount).toBe(100);
    expect(sale.paymentStatus).toBe("partial");
    expect(sale.commissionAmount).toBe(5);
    expect(paidLine.destroy).not.toHaveBeenCalled();
    expect(paidLine.update).not.toHaveBeenCalled();
  });

  it("redução permitida com paid+pending abaixo do novo total", async () => {
    const sale = completedSale({
      freightAmount: 20,
      totalAmount: 120,
      paidAmount: 60,
      paymentStatus: "partial"
    });
    paymentFindAll.mockResolvedValue([
      paymentRow({ id: 1, amount: 60, status: "paid" }),
      paymentRow({ id: 2, amount: 20, status: "pending", method: "boleto" })
    ]);

    await runDelivery(sale, { freightAmount: 0 }, methodRecord({
      kind: "pickup",
      defaultAmount: 0,
      allowAmountOverride: false,
      requiresAddress: false
    }));

    expect(sale.freightAmount).toBe(0);
    expect(sale.totalAmount).toBe(100);
    expect(sale.paidAmount).toBe(60);
    expect(sale.paymentStatus).toBe("partial");
  });

  it("bloqueia redução abaixo do recebido", async () => {
    const sale = completedSale({
      freightAmount: 20,
      totalAmount: 120,
      paidAmount: 120,
      paymentStatus: "paid"
    });
    paymentFindAll.mockResolvedValue([
      paymentRow({ amount: 120, status: "paid" })
    ]);

    await expect(
      runDelivery(sale, { freightAmount: 0 }, methodRecord({
        kind: "pickup",
        defaultAmount: 0,
        allowAmountOverride: false,
        requiresAddress: false
      }))
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_TOTAL_BELOW_PAID" });
  });

  it("bloqueia redução com pending overallocation e não reduz pending", async () => {
    const pending = paymentRow({
      id: 2,
      amount: 100,
      status: "pending",
      method: "boleto"
    });
    const sale = completedSale({
      freightAmount: 20,
      totalAmount: 120,
      paidAmount: 20,
      paymentStatus: "partial"
    });
    paymentFindAll.mockResolvedValue([
      paymentRow({ id: 1, amount: 20, status: "paid" }),
      pending
    ]);

    await expect(
      runDelivery(sale, { freightAmount: 0 }, methodRecord({
        kind: "pickup",
        defaultAmount: 0,
        allowAmountOverride: false,
        requiresAddress: false
      }))
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_TOTAL_BELOW_ALLOCATION"
    });
    expect(pending.destroy).not.toHaveBeenCalled();
    expect(pending.update).not.toHaveBeenCalled();
  });

  it("legacy pago sem lines usa cache como piso", async () => {
    const sale = completedSale({
      freightAmount: 20,
      totalAmount: 120,
      paidAmount: 120,
      paymentStatus: "paid",
      paymentMethod: null
    });
    paymentFindAll.mockResolvedValue([]);

    await expect(
      runDelivery(sale, { freightAmount: 0 }, methodRecord({
        kind: "pickup",
        defaultAmount: 0,
        allowAmountOverride: false,
        requiresAddress: false
      }))
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_SALE_TOTAL_BELOW_PAID" });
  });

  it("pickup → delivery aumenta total e deixa partial", async () => {
    const sale = completedSale({
      freightAmount: 0,
      totalAmount: 100,
      paidAmount: 100,
      paymentStatus: "paid",
      deliveryMethodId: 1,
      deliveryKind: "pickup"
    });
    paymentFindAll.mockResolvedValue([
      paymentRow({ amount: 100, status: "paid" })
    ]);

    await runDelivery(
      sale,
      { freightAmount: 10 },
      methodRecord({ id: 11, defaultAmount: 10, allowAmountOverride: true })
    );

    expect(sale.freightAmount).toBe(10);
    expect(sale.totalAmount).toBe(110);
    expect(sale.paymentStatus).toBe("partial");
    expect(sale.paidAmount).toBe(100);
  });

  it("método inativo novo é rejeitado; manter o atual inativo é permitido", async () => {
    const sale = completedSale({
      deliveryMethodId: 11,
      freightAmount: 20,
      totalAmount: 120,
      paidAmount: 60,
      paymentStatus: "partial"
    });
    paymentFindAll.mockResolvedValue([
      paymentRow({ amount: 60, status: "paid" })
    ]);

    await expect(
      runDelivery(
        sale,
        { freightAmount: 20 },
        methodRecord({ id: 99, active: false })
      )
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_DELIVERY_METHOD_INACTIVE"
    });

    await runDelivery(
      sale,
      { freightAmount: 25 },
      methodRecord({ id: 11, active: false, allowAmountOverride: true })
    );
    expect(sale.freightAmount).toBe(25);
  });

  it("refunded bloqueia", async () => {
    const sale = completedSale({ paymentStatus: "refunded" });
    saleFindOne.mockResolvedValue(sale);
    await expect(
      UpdateInventorySaleDeliveryService({
        companyId: 1,
        saleId: 50,
        body: { deliveryMethodId: 11 }
      })
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_PAYMENT_REFUNDED_UNSUPPORTED"
    });
  });

  it("usa LOCK.UPDATE na sale", async () => {
    const sale = completedSale({
      freightAmount: 0,
      totalAmount: 100,
      paidAmount: 50,
      paymentStatus: "partial"
    });
    paymentFindAll.mockResolvedValue([
      paymentRow({ amount: 50, status: "paid" })
    ]);
    await runDelivery(sale, { freightAmount: 10 });
    expect(sequelize.transaction).toHaveBeenCalled();
    expect(saleFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        lock: "UPDATE"
      })
    );
  });
});
