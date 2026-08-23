import AppError from "../../../errors/AppError";
import UpdateInventorySaleItemService from "../UpdateInventorySaleItemService";
import ShowInventorySaleService from "../ShowInventorySaleService";
import CancelInventorySaleService from "../CancelInventorySaleService";
import { buildInventorySaleItemIdentifierInclude } from "../inventorySaleItemIdentifiers";
import { buildInventorySaleIncludes } from "../inventorySaleHelpers";
import InventorySale from "../../../models/InventorySale";
import InventorySaleItem from "../../../models/InventorySaleItem";
import InventorySaleItemIdentifier from "../../../models/InventorySaleItemIdentifier";
import InventoryStockMovement from "../../../models/InventoryStockMovement";
import sequelize from "../../../database";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(
      async (cb: (t: { LOCK: { UPDATE: string } }) => Promise<unknown>) => {
        return cb({ LOCK: { UPDATE: "UPDATE" } });
      }
    )
  }
}));

jest.mock("../../../models/InventorySale", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/InventorySaleItem", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn() }
}));

jest.mock("../../../models/InventorySaleItemIdentifier", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    destroy: jest.fn(),
    bulkCreate: jest.fn()
  }
}));

jest.mock("../../../models/InventoryProduct", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../../../models/InventoryStockMovement", () => ({
  __esModule: true,
  default: { count: jest.fn(), create: jest.fn() }
}));

jest.mock("../inventorySaleHelpers", () => {
  const actual = jest.requireActual("../inventorySaleHelpers");
  return {
    ...actual,
    recalculateInventorySaleTotals: jest.fn().mockResolvedValue(undefined)
  };
});

const findSale = InventorySale.findOne as jest.Mock;
const findItem = InventorySaleItem.findOne as jest.Mock;
const findItems = InventorySaleItem.findAll as jest.Mock;
const findIdentifiers = InventorySaleItemIdentifier.findAll as jest.Mock;
const destroyIdentifiers = InventorySaleItemIdentifier.destroy as jest.Mock;
const bulkCreateIdentifiers =
  InventorySaleItemIdentifier.bulkCreate as jest.Mock;
const stockCount = InventoryStockMovement.count as jest.Mock;

function draftSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    companyId: 1,
    status: "draft",
    ...overrides
  };
}

function saleItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 21,
    companyId: 1,
    saleId: 7,
    quantity: 2,
    unitPrice: 100,
    discountAmount: 0,
    update: jest.fn().mockResolvedValue(undefined),
    reload: jest
      .fn()
      .mockImplementation(async function reload(this: {
        identifiers?: unknown[];
      }) {
        return this;
      }),
    ...overrides
  };
}

describe("identifiers — Update omitido vs [], lock, tenant, rollback, cancel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    destroyIdentifiers.mockResolvedValue(1);
    bulkCreateIdentifiers.mockResolvedValue([]);
    findIdentifiers.mockResolvedValue([]);
    stockCount.mockResolvedValue(0);
  });

  it("A) PUT só de preço com identifiers omitido não chama replace", async () => {
    const item = saleItem();
    findSale.mockResolvedValue(draftSale());
    findItem.mockResolvedValue(item);
    findIdentifiers.mockResolvedValue([
      { position: 1, identifier: "SN-A", companyId: 1, saleItemId: 21 }
    ]);

    await UpdateInventorySaleItemService({
      companyId: 1,
      saleId: 7,
      itemId: 21,
      body: { unitPrice: 120 }
    });

    expect(destroyIdentifiers).not.toHaveBeenCalled();
    expect(bulkCreateIdentifiers).not.toHaveBeenCalled();
    expect(item.update).toHaveBeenCalled();
  });

  it("B) PUT identifiers: [] remove todos", async () => {
    const item = saleItem();
    findSale.mockResolvedValue(draftSale());
    findItem.mockResolvedValue(item);

    await UpdateInventorySaleItemService({
      companyId: 1,
      saleId: 7,
      itemId: 21,
      body: { identifiers: [] }
    });

    expect(destroyIdentifiers).toHaveBeenCalledWith({
      where: { saleItemId: 21, companyId: 1 },
      transaction: expect.objectContaining({ LOCK: { UPDATE: "UPDATE" } })
    });
    expect(bulkCreateIdentifiers).not.toHaveBeenCalled();
  });

  it("C) PUT identifiers preenchidos substitui a lista", async () => {
    const item = saleItem();
    findSale.mockResolvedValue(draftSale());
    findItem.mockResolvedValue(item);

    await UpdateInventorySaleItemService({
      companyId: 1,
      saleId: 7,
      itemId: 21,
      body: {
        identifiers: [
          { position: 1, identifier: "NEW-1" },
          { position: 2, identifier: "NEW-2" }
        ]
      }
    });

    expect(destroyIdentifiers).toHaveBeenCalled();
    expect(bulkCreateIdentifiers).toHaveBeenCalledWith(
      [
        {
          companyId: 1,
          saleItemId: 21,
          position: 1,
          identifier: "NEW-1"
        },
        {
          companyId: 1,
          saleItemId: 21,
          position: 2,
          identifier: "NEW-2"
        }
      ],
      expect.objectContaining({
        transaction: expect.objectContaining({ LOCK: { UPDATE: "UPDATE" } })
      })
    );
  });

  it("integer → fractional com identifiers: [] persiste quantity 1.5 e apaga identifiers", async () => {
    const item = saleItem();
    findSale.mockResolvedValue(draftSale());
    findItem.mockResolvedValue(item);

    await UpdateInventorySaleItemService({
      companyId: 1,
      saleId: 7,
      itemId: 21,
      body: { quantity: 1.5, identifiers: [] }
    });

    expect(item.update).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 1.5 }),
      expect.anything()
    );
    expect(destroyIdentifiers).toHaveBeenCalled();
    expect(bulkCreateIdentifiers).not.toHaveBeenCalled();
  });

  it("integer → fractional com identifiers omitido e linhas existentes bloqueia", async () => {
    findSale.mockResolvedValue(draftSale());
    findItem.mockResolvedValue(saleItem());
    findIdentifiers.mockResolvedValue([{ position: 1, identifier: "SN-A" }]);

    await expect(
      UpdateInventorySaleItemService({
        companyId: 1,
        saleId: 7,
        itemId: 21,
        body: { quantity: 1.5 }
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(destroyIdentifiers).not.toHaveBeenCalled();
  });

  it("lock FOR UPDATE no sale e no item antes de sincronizar identifiers", async () => {
    const order: string[] = [];
    findSale.mockImplementation(async () => {
      order.push("sale");
      return draftSale();
    });
    findItem.mockImplementation(async () => {
      order.push("item");
      return saleItem();
    });
    destroyIdentifiers.mockImplementation(async () => {
      order.push("destroy");
      return 1;
    });
    bulkCreateIdentifiers.mockImplementation(async () => {
      order.push("create");
      return [];
    });

    await UpdateInventorySaleItemService({
      companyId: 1,
      saleId: 7,
      itemId: 21,
      body: { identifiers: [{ position: 1, identifier: "SN1" }] }
    });

    expect(findSale).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7, companyId: 1 },
        lock: "UPDATE"
      })
    );
    expect(findItem).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 21, saleId: 7, companyId: 1 },
        lock: "UPDATE"
      })
    );
    expect(order.indexOf("sale")).toBeLessThan(order.indexOf("item"));
    expect(order.indexOf("item")).toBeLessThan(order.indexOf("destroy"));
    expect(order.indexOf("destroy")).toBeLessThan(order.indexOf("create"));
  });

  it("multiempresa: item de outra company não é atualizado", async () => {
    findSale.mockResolvedValue(draftSale());
    findItem.mockResolvedValue(null);

    await expect(
      UpdateInventorySaleItemService({
        companyId: 1,
        saleId: 7,
        itemId: 99,
        body: { identifiers: [{ position: 1, identifier: "SN-X" }] }
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(destroyIdentifiers).not.toHaveBeenCalled();
  });

  it("rollback: falha no bulkCreate propaga na mesma transaction", async () => {
    const item = saleItem();
    findSale.mockResolvedValue(draftSale());
    findItem.mockResolvedValue(item);
    bulkCreateIdentifiers.mockRejectedValue(new Error("persist fail"));

    await expect(
      UpdateInventorySaleItemService({
        companyId: 1,
        saleId: 7,
        itemId: 21,
        body: {
          quantity: 2,
          identifiers: [{ position: 1, identifier: "SN1" }]
        }
      })
    ).rejects.toThrow("persist fail");
    expect(item.update).toHaveBeenCalled();
    expect(destroyIdentifiers).toHaveBeenCalled();
    expect(sequelize.transaction).toHaveBeenCalled();
  });

  it("Show filtra identifiers pela company da venda", async () => {
    const sale = {
      reload: jest.fn().mockResolvedValue({ id: 9, companyId: 1, items: [] })
    };
    findSale.mockResolvedValue(sale);

    await ShowInventorySaleService({ companyId: 1, id: 9 });

    const { include } = sale.reload.mock.calls[0][0];
    const itemsInc = include.find((row: { as?: string }) => row.as === "items");
    const identInc = itemsInc.include.find(
      (row: { as?: string }) => row.as === "identifiers"
    );
    expect(identInc.where).toEqual({ companyId: 1 });
    expect(identInc.separate).toBe(true);

    const leaked = buildInventorySaleItemIdentifierInclude(1);
    expect(leaked.where).toEqual({ companyId: 1 });
    expect(buildInventorySaleItemIdentifierInclude(2).where).toEqual({
      companyId: 2
    });
  });

  it("include do Show da company A não pede identifiers da company B", () => {
    const includes = buildInventorySaleIncludes(10);
    const itemsInc = includes.find(
      row => "as" in row && row.as === "items"
    ) as {
      include: Array<{ as?: string; where?: { companyId: number } }>;
    };
    const identInc = itemsInc.include.find(row => row.as === "identifiers");
    expect(identInc?.where).toEqual({ companyId: 10 });
  });

  it("cancelamento de completed preserva identifiers (não destroi)", async () => {
    const sale = {
      id: 7,
      companyId: 1,
      status: "completed",
      saleNumber: 12,
      paidAt: null,
      update: jest.fn().mockResolvedValue(undefined),
      reload: jest.fn().mockResolvedValue({
        id: 7,
        status: "cancelled",
        items: [
          {
            id: 21,
            identifiers: [
              { position: 1, identifier: "SN-A", companyId: 1, saleItemId: 21 }
            ]
          }
        ]
      })
    };
    findSale.mockResolvedValue(sale);
    findItems.mockResolvedValue([
      { id: 21, trackStock: false, companyId: 1, productId: 3, quantity: 2 }
    ]);

    const result = await CancelInventorySaleService({
      companyId: 1,
      saleId: 7,
      cancelledBy: 4,
      cancelReason: "cliente desistiu"
    });

    expect(destroyIdentifiers).not.toHaveBeenCalled();
    expect(sale.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
      expect.anything()
    );
    expect(result.items[0].identifiers[0].identifier).toBe("SN-A");
  });
});
