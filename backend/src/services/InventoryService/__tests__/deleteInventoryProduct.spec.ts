import { ForeignKeyConstraintError } from "sequelize";
import InventoryProduct from "../../../models/InventoryProduct";
import InventoryProductVariant from "../../../models/InventoryProductVariant";
import InventorySaleItem from "../../../models/InventorySaleItem";
import InventoryStockMovement from "../../../models/InventoryStockMovement";
import sequelize from "../../../database";
import DeleteInventoryProductService from "../DeleteInventoryProductService";

/** Unidade (mocks). Cenários com vendas, movimentações e rollback: __integration__/inventoryProductDelete.it.spec.ts */
describe("DeleteInventoryProductService", () => {
  const findOneProduct = jest.spyOn(InventoryProduct, "findOne");
  const findSaleItems = jest.spyOn(InventorySaleItem, "findAll");
  const destroyMovements = jest.spyOn(InventoryStockMovement, "destroy");
  const destroyVariants = jest.spyOn(InventoryProductVariant, "destroy");
  const transaction = jest.spyOn(sequelize, "transaction");

  const productRow = { id: 5, companyId: 4, destroy: jest.fn() };

  beforeEach(() => {
    findOneProduct.mockReset().mockResolvedValue(productRow as never);
    findSaleItems.mockReset().mockResolvedValue([] as never);
    destroyMovements.mockReset().mockResolvedValue(0 as never);
    destroyVariants.mockReset().mockResolvedValue(0 as never);
    productRow.destroy.mockReset().mockResolvedValue(undefined as never);
    transaction.mockImplementation((async (fn: any) => fn({ LOCK: { UPDATE: "UPDATE" } })) as any);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("exclui produto sem histórico, filtrando sempre pela empresa", async () => {
    const result = await DeleteInventoryProductService({ companyId: 4, id: 5 });
    expect(productRow.destroy).toHaveBeenCalledTimes(1);
    expect(findOneProduct.mock.calls[0][0]).toMatchObject({ where: { id: 5, companyId: 4 } });
    expect(destroyMovements.mock.calls[0][0]).toMatchObject({ where: { companyId: 4, productId: 5 } });
    expect(destroyVariants.mock.calls[0][0]).toMatchObject({ where: { companyId: 4, productId: 5 } });
    expect(result).toEqual({ removedStockMovements: 0, removedDraftItems: 0, removedDraftSales: 0, removedCancelledSales: 0, detachedSaleItems: 0 });
  });

  it("rejeita produto de outra empresa sem excluir nada", async () => {
    findOneProduct.mockResolvedValue(null as never);
    await expect(DeleteInventoryProductService({ companyId: 4, id: 5 })).rejects.toMatchObject({
      message: "ERR_INVENTORY_PRODUCT_NOT_FOUND"
    });
    expect(destroyMovements).not.toHaveBeenCalled();
    expect(productRow.destroy).not.toHaveBeenCalled();
  });

  it("referência criada em paralelo (violação de FK) vira conflito", async () => {
    productRow.destroy.mockRejectedValue(new ForeignKeyConstraintError({ parent: new Error("restrict") }));
    await expect(DeleteInventoryProductService({ companyId: 4, id: 5 })).rejects.toMatchObject({
      message: "ERR_INVENTORY_PRODUCT_DELETE_CONFLICT"
    });
  });
});
