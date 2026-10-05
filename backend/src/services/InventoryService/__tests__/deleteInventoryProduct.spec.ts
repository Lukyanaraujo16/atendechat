import { ForeignKeyConstraintError } from "sequelize";
import InventoryProduct from "../../../models/InventoryProduct";
import InventorySaleItem from "../../../models/InventorySaleItem";
import InventoryStockMovement from "../../../models/InventoryStockMovement";
import sequelize from "../../../database";
import DeleteInventoryProductService from "../DeleteInventoryProductService";

describe("DeleteInventoryProductService", () => {
  const findOneProduct = jest.spyOn(InventoryProduct, "findOne");
  const destroyProduct = jest.spyOn(InventoryProduct, "destroy");
  const findSaleItem = jest.spyOn(InventorySaleItem, "findOne");
  const findMovement = jest.spyOn(InventoryStockMovement, "findOne");
  const transaction = jest.spyOn(sequelize, "transaction");

  const productRow = { id: 5, companyId: 4, destroy: jest.fn() };

  beforeEach(() => {
    findOneProduct.mockReset();
    findSaleItem.mockReset().mockResolvedValue(null as never);
    findMovement.mockReset().mockResolvedValue(null as never);
    destroyProduct.mockReset();
    productRow.destroy.mockReset().mockResolvedValue(undefined as never);
    transaction.mockImplementation((async (fn: any) =>
      fn({
        LOCK: { UPDATE: "UPDATE" }
      })) as any);
    findOneProduct.mockResolvedValue(productRow as never);
  });

  afterAll(() => {
    findOneProduct.mockRestore();
    destroyProduct.mockRestore();
    findSaleItem.mockRestore();
    findMovement.mockRestore();
    transaction.mockRestore();
  });

  it("exclui produto sem histórico", async () => {
    await DeleteInventoryProductService({ companyId: 4, id: 5 });
    expect(productRow.destroy).toHaveBeenCalledTimes(1);
  });

  it("rejeita produto de outra empresa", async () => {
    findOneProduct.mockResolvedValue(null as never);
    await expect(
      DeleteInventoryProductService({ companyId: 4, id: 5 })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_PRODUCT_NOT_FOUND" });
    expect(productRow.destroy).not.toHaveBeenCalled();
  });

  it("bloqueia produto com item de venda", async () => {
    findSaleItem.mockResolvedValue({ id: 1 } as never);
    await expect(
      DeleteInventoryProductService({ companyId: 4, id: 5 })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_PRODUCT_HAS_HISTORY" });
    expect(productRow.destroy).not.toHaveBeenCalled();
  });

  it("bloqueia produto com movimentação de estoque", async () => {
    findMovement.mockResolvedValue({ id: 9 } as never);
    await expect(
      DeleteInventoryProductService({ companyId: 4, id: 5 })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_PRODUCT_HAS_HISTORY" });
    expect(productRow.destroy).not.toHaveBeenCalled();
  });

  it("converte violação de FK em erro de histórico", async () => {
    productRow.destroy.mockRejectedValue(
      new ForeignKeyConstraintError({ parent: new Error("restrict") })
    );
    await expect(
      DeleteInventoryProductService({ companyId: 4, id: 5 })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_PRODUCT_HAS_HISTORY" });
  });
});
