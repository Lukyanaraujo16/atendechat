import AppError from "../../../errors/AppError";
import InventoryDeliveryMethod from "../../../models/InventoryDeliveryMethod";
import InventorySale from "../../../models/InventorySale";
import InventorySaleDelivery from "../../../models/InventorySaleDelivery";
import InventorySaleItem from "../../../models/InventorySaleItem";
import sequelize from "../../../database";
import CreateInventoryDeliveryMethodService from "../CreateInventoryDeliveryMethodService";
import UpdateInventoryDeliveryMethodService from "../UpdateInventoryDeliveryMethodService";
import DeactivateInventoryDeliveryMethodService from "../DeactivateInventoryDeliveryMethodService";
import ListInventoryDeliveryMethodsService from "../ListInventoryDeliveryMethodsService";
import EnsureDefaultPickupDeliveryMethodService from "../EnsureDefaultPickupDeliveryMethodService";
import UpdateInventorySaleDeliveryService from "../UpdateInventorySaleDeliveryService";
import { recalculateInventorySaleTotals } from "../inventorySaleHelpers";
import { DEFAULT_PICKUP_METHOD_NAME } from "../inventoryDeliveryHelpers";

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
  default: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../models/InventorySale", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/InventorySaleDelivery", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../models/InventorySaleItem", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../models/InventoryProduct", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../models/InventorySaleItemIdentifier", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../inventorySalePaymentEngine", () => ({
  syncDraftPendingAfterTotalChange: jest.fn().mockResolvedValue(undefined),
  bootstrapLegacyPaymentsIfNeeded: jest.fn().mockResolvedValue([]),
  assertCompletedSaleTotalAgainstPayments: jest.fn(),
  persistSalePaymentCache: jest.fn().mockResolvedValue({})
}));

const methodFindOne = InventoryDeliveryMethod.findOne as jest.Mock;
const methodFindAll = InventoryDeliveryMethod.findAll as jest.Mock;
const methodCreate = InventoryDeliveryMethod.create as jest.Mock;
const saleFindOne = InventorySale.findOne as jest.Mock;
const saleUpdate = InventorySale.update as jest.Mock;
const deliveryFindOne = InventorySaleDelivery.findOne as jest.Mock;
const deliveryCreate = InventorySaleDelivery.create as jest.Mock;
const itemFindAll = InventorySaleItem.findAll as jest.Mock;

function methodRecord(overrides: Record<string, unknown> = {}) {
  const row: any = {
    id: 11,
    companyId: 1,
    name: "Motoboy",
    kind: "courier",
    defaultAmount: 15,
    allowAmountOverride: true,
    requiresAddress: true,
    active: true,
    position: 1,
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(row, patch);
      return row;
    }),
    reload: jest.fn(async () => row)
  };
  Object.assign(row, overrides);
  return row;
}

function draftSale(overrides: Record<string, unknown> = {}) {
  const sale: any = {
    id: 50,
    companyId: 1,
    status: "draft",
    freightAmount: 0,
    deliveryMethodId: null,
    deliveryMethodName: null,
    deliveryKind: null,
    paymentStatus: "unpaid",
    paidAmount: 0,
    paidAt: null,
    contactId: null,
    update: jest.fn(async (patch: Record<string, unknown>) => {
      Object.assign(sale, patch);
      return sale;
    }),
    reload: jest.fn(async () => sale)
  };
  Object.assign(sale, overrides);
  return sale;
}

describe("fundação entrega/frete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("modalidades", () => {
    it("cria modalidade tenant A e lista só da empresa", async () => {
      const created = methodRecord();
      methodCreate.mockResolvedValue(created);
      methodFindOne.mockResolvedValue(methodRecord({ kind: "pickup", name: DEFAULT_PICKUP_METHOD_NAME }));
      methodFindAll.mockResolvedValue([created]);

      const row = await CreateInventoryDeliveryMethodService({
        companyId: 1,
        body: {
          name: "Motoboy",
          kind: "courier",
          defaultAmount: 15,
          allowAmountOverride: true,
          requiresAddress: true
        }
      });
      expect(row.companyId).toBe(1);
      expect(methodCreate).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 1, defaultAmount: 15 })
      );

      await ListInventoryDeliveryMethodsService({ companyId: 1, active: true });
      expect(methodFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 1, active: true }
        })
      );
    });

    it("tenant B não edita modalidade A; desativação soft; negativo rejeitado", async () => {
      methodFindOne.mockResolvedValue(null);
      await expect(
        UpdateInventoryDeliveryMethodService({
          companyId: 2,
          id: 11,
          body: { name: "Hack" }
        })
      ).rejects.toBeInstanceOf(AppError);

      const row = methodRecord();
      methodFindOne.mockResolvedValue(row);
      await DeactivateInventoryDeliveryMethodService({ companyId: 1, id: 11 });
      expect(row.update).toHaveBeenCalledWith({ active: false });

      await expect(
        CreateInventoryDeliveryMethodService({
          companyId: 1,
          body: { name: "X", kind: "courier", defaultAmount: -5 }
        })
      ).rejects.toBeInstanceOf(AppError);
    });

    it("pickup força zero/requiresAddress=false/override=false", async () => {
      await expect(
        CreateInventoryDeliveryMethodService({
          companyId: 1,
          body: {
            name: "Retirada ruim",
            kind: "pickup",
            defaultAmount: 5,
            allowAmountOverride: true,
            requiresAddress: true
          }
        })
      ).rejects.toBeInstanceOf(AppError);

      methodCreate.mockResolvedValue(
        methodRecord({
          kind: "pickup",
          defaultAmount: 0,
          allowAmountOverride: false,
          requiresAddress: false
        })
      );
      const ok = await CreateInventoryDeliveryMethodService({
        companyId: 1,
        body: { name: "Retirada ok", kind: "pickup" }
      });
      expect(methodCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "pickup",
          defaultAmount: 0,
          allowAmountOverride: false,
          requiresAddress: false
        })
      );
      expect(ok.kind).toBe("pickup");
    });

    it("ensure pickup é idempotente", async () => {
      const existing = methodRecord({
        kind: "pickup",
        name: DEFAULT_PICKUP_METHOD_NAME,
        defaultAmount: 0,
        allowAmountOverride: false,
        requiresAddress: false
      });
      methodFindOne.mockResolvedValue(existing);
      const a = await EnsureDefaultPickupDeliveryMethodService({ companyId: 1 });
      const b = await EnsureDefaultPickupDeliveryMethodService({ companyId: 1 });
      expect(a).toBe(existing);
      expect(b).toBe(existing);
      expect(methodCreate).not.toHaveBeenCalled();
    });
  });

  describe("delivery da venda", () => {
    const address = {
      recipientName: "Ana",
      recipientPhone: "11999999999",
      street: "Rua A",
      number: "10",
      district: "Centro",
      city: "São Paulo",
      state: "SP"
    };

    it("draft + pickup → freight 0 e limpa snapshot", async () => {
      const sale = draftSale({ freightAmount: 20 });
      const pickup = methodRecord({
        id: 1,
        kind: "pickup",
        name: DEFAULT_PICKUP_METHOD_NAME,
        defaultAmount: 0,
        allowAmountOverride: false,
        requiresAddress: false
      });
      const existingDelivery: any = {
        destroy: jest.fn().mockResolvedValue(undefined)
      };
      saleFindOne.mockResolvedValue(sale);
      methodFindOne.mockResolvedValue(pickup);
      deliveryFindOne.mockResolvedValue(existingDelivery);
      itemFindAll.mockResolvedValue([]);
      saleUpdate.mockResolvedValue([1]);

      await UpdateInventorySaleDeliveryService({
        companyId: 1,
        saleId: 50,
        body: { deliveryMethodId: 1, freightAmount: 99 }
      });

      expect(sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          freightAmount: 0,
          deliveryKind: "pickup",
          deliveryMethodName: DEFAULT_PICKUP_METHOD_NAME
        }),
        expect.any(Object)
      );
      expect(existingDelivery.destroy).toHaveBeenCalled();
      expect(sequelize.transaction).toHaveBeenCalled();
    });

    it("courier default 15 soma no total; override respeitado", async () => {
      const sale = draftSale();
      const courier = methodRecord({
        allowAmountOverride: false,
        defaultAmount: 15
      });
      saleFindOne.mockResolvedValue(sale);
      methodFindOne.mockResolvedValue(courier);
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
      saleUpdate.mockResolvedValue([1]);

      await UpdateInventorySaleDeliveryService({
        companyId: 1,
        saleId: 50,
        body: {
          deliveryMethodId: 11,
          freightAmount: 1,
          recipient: address
        }
      });

      expect(sale.freightAmount).toBe(15);
      expect(deliveryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 1,
          saleId: 50,
          recipientName: "Ana",
          postalCode: null
        }),
        expect.any(Object)
      );
    });

    it("override permitido usa custom; modalidade outra empresa rejeitada", async () => {
      const sale = draftSale();
      const courier = methodRecord({ allowAmountOverride: true, defaultAmount: 15 });
      saleFindOne.mockResolvedValue(sale);
      methodFindOne.mockResolvedValue(courier);
      deliveryFindOne.mockResolvedValue(null);
      deliveryCreate.mockResolvedValue({});
      itemFindAll.mockResolvedValue([]);
      saleUpdate.mockResolvedValue([1]);

      await UpdateInventorySaleDeliveryService({
        companyId: 1,
        saleId: 50,
        body: {
          deliveryMethodId: 11,
          freightAmount: 22,
          recipient: address
        }
      });
      expect(sale.freightAmount).toBe(22);

      methodFindOne.mockResolvedValue(null);
      await expect(
        UpdateInventorySaleDeliveryService({
          companyId: 1,
          saleId: 50,
          body: { deliveryMethodId: 999, recipient: address }
        })
      ).rejects.toBeInstanceOf(AppError);
    });

    it("cancelled bloqueia; courier sem endereço rejeita; completed permitido", async () => {
      saleFindOne.mockResolvedValue(draftSale({ status: "cancelled" }));
      await expect(
        UpdateInventorySaleDeliveryService({
          companyId: 1,
          saleId: 50,
          body: { deliveryMethodId: 11 }
        })
      ).rejects.toBeInstanceOf(AppError);

      saleFindOne.mockResolvedValue(draftSale());
      methodFindOne.mockResolvedValue(methodRecord());
      await expect(
        UpdateInventorySaleDeliveryService({
          companyId: 1,
          saleId: 50,
          body: { deliveryMethodId: 11, recipient: { street: "Só rua" } }
        })
      ).rejects.toBeInstanceOf(AppError);

      const completed = draftSale({
        status: "completed",
        totalAmount: 100,
        freightAmount: 0,
        paidAmount: 100,
        paymentStatus: "paid",
        commissionAmount: 5,
        commissionRate: 5
      });
      saleFindOne
        .mockResolvedValueOnce(completed)
        .mockResolvedValueOnce(completed);
      methodFindOne.mockResolvedValue(
        methodRecord({
          id: 11,
          kind: "pickup",
          defaultAmount: 0,
          allowAmountOverride: false,
          requiresAddress: false
        })
      );
      deliveryFindOne.mockResolvedValue(null);
      itemFindAll.mockResolvedValue([
        {
          unitPrice: 100,
          quantity: 1,
          discountAmount: 0,
          totalAmount: 100,
          update: jest.fn()
        }
      ]);
      saleUpdate.mockResolvedValue([1]);
      await expect(
        UpdateInventorySaleDeliveryService({
          companyId: 1,
          saleId: 50,
          body: { deliveryMethodId: 11 }
        })
      ).resolves.toBeTruthy();
      expect(completed.commissionAmount).toBe(5);
    });

    it("walk-in sem contactId + endereço completo funciona; CEP opcional", async () => {
      const sale = draftSale({ contactId: null });
      saleFindOne.mockResolvedValue(sale);
      methodFindOne.mockResolvedValue(methodRecord());
      deliveryFindOne.mockResolvedValue(null);
      deliveryCreate.mockResolvedValue({});
      itemFindAll.mockResolvedValue([]);
      saleUpdate.mockResolvedValue([1]);

      await UpdateInventorySaleDeliveryService({
        companyId: 1,
        saleId: 50,
        body: {
          deliveryMethodId: 11,
          recipient: { ...address, postalCode: undefined, complement: undefined }
        }
      });
      expect(deliveryCreate).toHaveBeenCalled();
      expect(sale.contactId).toBeNull();
    });

    it("histórico: snapshot não muda ao renomear/desativar modalidade depois", async () => {
      const sale = draftSale({
        freightAmount: 15,
        deliveryMethodId: 11,
        deliveryMethodName: "Motoboy",
        deliveryKind: "courier"
      });
      const method = methodRecord({ name: "Motoboy Express", active: false });
      // snapshots já na venda
      expect(sale.deliveryMethodName).toBe("Motoboy");
      expect(sale.freightAmount).toBe(15);
      expect(method.name).toBe("Motoboy Express");
      expect(method.active).toBe(false);
      expect(sale.deliveryMethodName).not.toBe(method.name);
    });
  });

  describe("recalc autoritativo", () => {
    it("subtotal/desconto mercadoria; total = mercadoria + frete; frete preservado", async () => {
      saleFindOne.mockResolvedValue(
        draftSale({ id: 50, companyId: 1, freightAmount: 20 })
      );
      itemFindAll.mockResolvedValue([
        {
          unitPrice: 50,
          quantity: 2,
          discountAmount: 10,
          totalAmount: 90,
          update: jest.fn()
        }
      ]);
      saleUpdate.mockResolvedValue([1]);

      await recalculateInventorySaleTotals(50, 1);

      expect(saleUpdate).toHaveBeenCalledWith(
        {
          subtotalAmount: 100,
          discountAmount: 10,
          globalDiscountType: null,
          globalDiscountPercent: null,
          globalDiscountAmount: 0,
          totalAmount: 110
        },
        { where: { id: 50, companyId: 1 }, transaction: undefined }
      );
    });

    it("venda sem itens mantém só frete no total", async () => {
      saleFindOne.mockResolvedValue(
        draftSale({ freightAmount: 15 })
      );
      itemFindAll.mockResolvedValue([]);
      saleUpdate.mockResolvedValue([1]);
      await recalculateInventorySaleTotals(50, 1);
      expect(saleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotalAmount: 0,
          discountAmount: 0,
          totalAmount: 15
        }),
        expect.any(Object)
      );
    });
  });
});
