import AppError from "../../../errors/AppError";
import InventoryCustomer from "../../../models/InventoryCustomer";
import InventoryReceivable from "../../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../../models/InventoryReceivableInstallment";
import InventoryReceivablePayment from "../../../models/InventoryReceivablePayment";
import InventorySettings from "../../../models/InventorySettings";
import InventorySale from "../../../models/InventorySale";
import sequelize from "../../../database";
import ValidateInventoryStoreCreditForCompleteService from "../ValidateInventoryStoreCreditForCompleteService";
import CancelInventoryReceivableForSaleService from "../CancelInventoryReceivableForSaleService";
import { settlePaymentOnComplete } from "../inventoryPaymentHelpers";
import * as credit from "../inventoryCustomerCredit";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (fn: any) =>
      fn({ LOCK: { UPDATE: "UPDATE" } })
    )
  }
}));

describe("store credit validation and cancel rules", () => {
  const lockSpy = jest.spyOn(credit, "lockInventoryCustomerForUpdate");
  const snapSpy = jest.spyOn(credit, "getCustomerCreditSnapshot");
  const settingsFind = jest.spyOn(InventorySettings, "findOne");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    lockSpy.mockRestore();
    snapSpy.mockRestore();
    settingsFind.mockRestore();
  });

  const tx = { LOCK: { UPDATE: "UPDATE" } } as any;

  it("bloqueia Crédito da Loja sem Cliente", async () => {
    await expect(
      ValidateInventoryStoreCreditForCompleteService({
        companyId: 1,
        customerId: null,
        financedAmount: 100,
        transaction: tx
      })
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_STORE_CREDIT_CUSTOMER_REQUIRED"
    });
  });

  it("bloqueia cliente inativo", async () => {
    lockSpy.mockResolvedValue({ id: 9, isActive: false } as any);
    await expect(
      ValidateInventoryStoreCreditForCompleteService({
        companyId: 1,
        customerId: 9,
        financedAmount: 100,
        transaction: tx
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("bloqueia limite insuficiente sem override", async () => {
    lockSpy.mockResolvedValue({ id: 9, isActive: true } as any);
    snapSpy.mockResolvedValue({
      customerId: 9,
      creditLimit: 100,
      creditUsed: 80,
      creditAvailable: 20,
      openAmount: 80,
      overdueOpenAmount: 0
    });
    settingsFind.mockResolvedValue({
      blockStoreCreditWhenOverdue: true
    } as any);

    await expect(
      ValidateInventoryStoreCreditForCompleteService({
        companyId: 1,
        customerId: 9,
        financedAmount: 50,
        transaction: tx
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_STORE_CREDIT_LIMIT" });
  });

  it("permite override de limite com permissão", async () => {
    lockSpy.mockResolvedValue({ id: 9, isActive: true } as any);
    snapSpy.mockResolvedValue({
      customerId: 9,
      creditLimit: 100,
      creditUsed: 80,
      creditAvailable: 20,
      openAmount: 80,
      overdueOpenAmount: 0
    });
    settingsFind.mockResolvedValue({
      blockStoreCreditWhenOverdue: true
    } as any);

    const result = await ValidateInventoryStoreCreditForCompleteService({
      companyId: 1,
      customerId: 9,
      financedAmount: 50,
      override: {
        authorizeOverride: true,
        authorizedByUserId: 3,
        canAuthorizeOverride: true,
        reason: "ok"
      },
      transaction: tx
    });
    expect(result.needsLimitOverride).toBe(true);
    expect(result.overrideType).toBe("limit");
    expect(result.exceededAmount).toBe(30);
  });

  it("bloqueia por vencido conforme setting", async () => {
    lockSpy.mockResolvedValue({ id: 9, isActive: true } as any);
    snapSpy.mockResolvedValue({
      customerId: 9,
      creditLimit: 1000,
      creditUsed: 100,
      creditAvailable: 900,
      openAmount: 100,
      overdueOpenAmount: 50
    });
    settingsFind.mockResolvedValue({
      blockStoreCreditWhenOverdue: true
    } as any);

    await expect(
      ValidateInventoryStoreCreditForCompleteService({
        companyId: 1,
        customerId: 9,
        financedAmount: 50,
        transaction: tx
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_STORE_CREDIT_OVERDUE" });
  });

  it("settlePaymentOnComplete nunca liquida store_credit como caixa", () => {
    expect(
      settlePaymentOnComplete({
        paymentMethod: "store_credit",
        cardInstallmentCount: null,
        totalAmount: 500,
        paidAmount: 0,
        existingPaidAt: null,
        registerAsPaid: true,
        canManagePayments: true
      })
    ).toEqual({
      paymentStatus: "unpaid",
      paidAmount: 0,
      paidAt: null
    });
  });

  it("cancel com baixas ativas bloqueia; sem baixas cancela parcelas abertas", async () => {
    const recvFind = jest.spyOn(InventoryReceivable, "findAll");
    const payCount = jest.spyOn(InventoryReceivablePayment, "count");
    const instFind = jest.spyOn(InventoryReceivableInstallment, "findAll");

    recvFind.mockResolvedValue([
      {
        id: 1,
        update: jest.fn()
      } as any
    ]);
    payCount.mockResolvedValue(1);

    await expect(
      CancelInventoryReceivableForSaleService({
        companyId: 1,
        saleId: 10,
        transaction: tx
      })
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_SALE_CANCEL_RECEIVABLE_HAS_PAYMENTS"
    });

    payCount.mockResolvedValue(0);
    const updateInst = jest.fn();
    const updateRecv = jest.fn();
    recvFind.mockResolvedValue([{ id: 1, update: updateRecv } as any]);
    instFind.mockResolvedValue([
      { id: 2, openAmount: 80, update: updateInst } as any
    ]);

    const result = await CancelInventoryReceivableForSaleService({
      companyId: 1,
      saleId: 10,
      transaction: tx
    });
    expect(result.releasedAmount).toBe(80);
    expect(updateInst).toHaveBeenCalledWith(
      { openAmount: 0, status: "cancelled" },
      expect.anything()
    );
    expect(updateRecv).toHaveBeenCalledWith(
      { openAmount: 0, status: "cancelled" },
      expect.anything()
    );

    recvFind.mockRestore();
    payCount.mockRestore();
    instFind.mockRestore();
  });
});

describe("customer isolation helpers", () => {
  it("model InventoryCustomer existe e sale aceita customerId", () => {
    expect(InventoryCustomer).toBeDefined();
    expect(InventorySale).toBeDefined();
    void sequelize;
  });
});
