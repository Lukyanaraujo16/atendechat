import InventorySale from "../../../models/InventorySale";
import InventorySaleItem from "../../../models/InventorySaleItem";
import { recalculateInventorySaleTotals } from "../inventorySaleHelpers";

jest.mock("../../../models/InventorySale", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/InventorySaleItem", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn()
  }
}));

const saleFindOne = InventorySale.findOne as jest.Mock;
const saleUpdate = InventorySale.update as jest.Mock;
const itemFindAll = InventorySaleItem.findAll as jest.Mock;

function draftSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyId: 1,
    status: "draft",
    freightAmount: 0,
    globalDiscountType: null,
    globalDiscountAmount: 0,
    globalDiscountPercent: null,
    ...overrides
  };
}

function lineItem(overrides: Record<string, unknown> = {}) {
  return {
    unitPrice: 1000,
    quantity: 1,
    discountType: "fixed",
    discountAmount: 100,
    discountPercent: null,
    totalAmount: 900,
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("recalculateInventorySaleTotals — descontos (casos E/F)", () => {
  beforeEach(() => {
    saleFindOne.mockReset();
    saleUpdate.mockReset();
    itemFindAll.mockReset();
    saleUpdate.mockResolvedValue([1]);
  });

  test("Caso E — item R$100 + global 10% → mercadoria 810", async () => {
    saleFindOne.mockResolvedValue(
      draftSale({
        globalDiscountType: "percentage",
        globalDiscountPercent: 10,
        freightAmount: 0
      })
    );
    itemFindAll.mockResolvedValue([lineItem()]);

    await recalculateInventorySaleTotals(1, 1);

    expect(saleUpdate).toHaveBeenCalledWith(
      {
        subtotalAmount: 1000,
        discountAmount: 100,
        globalDiscountType: "percentage",
        globalDiscountPercent: 10,
        globalDiscountAmount: 90,
        totalAmount: 810
      },
      { where: { id: 1, companyId: 1 }, transaction: undefined }
    );
  });

  test("Caso F — frete fora da base; total = mercadoria líquida + frete", async () => {
    saleFindOne.mockResolvedValue(
      draftSale({
        globalDiscountType: "percentage",
        globalDiscountPercent: 10,
        freightAmount: 30
      })
    );
    itemFindAll.mockResolvedValue([lineItem()]);

    await recalculateInventorySaleTotals(1, 1);

    expect(saleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        globalDiscountAmount: 90,
        totalAmount: 840
      }),
      expect.any(Object)
    );
  });

  test("global fixed equivalente ao percentual do caso E", async () => {
    saleFindOne.mockResolvedValue(
      draftSale({
        globalDiscountType: "fixed",
        globalDiscountAmount: 90,
        freightAmount: 30
      })
    );
    itemFindAll.mockResolvedValue([lineItem()]);

    await recalculateInventorySaleTotals(1, 1);

    expect(saleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        globalDiscountAmount: 90,
        totalAmount: 840
      }),
      expect.any(Object)
    );
  });

  test("sincroniza discountAmount/totalAmount da linha quando % informado", async () => {
    const item = lineItem({
      discountType: "percentage",
      discountPercent: 10,
      discountAmount: 0,
      totalAmount: 0,
      unitPrice: 100,
      quantity: 3
    });
    saleFindOne.mockResolvedValue(draftSale());
    itemFindAll.mockResolvedValue([item]);

    await recalculateInventorySaleTotals(1, 1);

    expect(item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        discountAmount: 30,
        totalAmount: 270
      }),
      expect.any(Object)
    );
    expect(saleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalAmount: 300,
        discountAmount: 30,
        totalAmount: 270
      }),
      expect.any(Object)
    );
  });
});
