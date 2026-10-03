import AppError from "../../../errors/AppError";
import InventoryStockMovement from "../../../models/InventoryStockMovement";
import CreateInventoryStockMovementService from "../CreateInventoryStockMovementService";
import ListInventoryStockMovementsService from "../ListInventoryStockMovementsService";
import {
  isInventoryStockMovementType,
  isListableInventoryStockMovementType,
  LISTABLE_INVENTORY_STOCK_MOVEMENT_TYPES,
  MANUAL_INVENTORY_STOCK_MOVEMENT_TYPES
} from "../inventoryStockMovementTypes";

describe("tipos de movimentação de estoque", () => {
  const findAndCountAll = jest
    .spyOn(InventoryStockMovement, "findAndCountAll")
    .mockResolvedValue({ rows: [], count: 0 } as never);

  afterAll(() => {
    findAndCountAll.mockRestore();
  });

  it("listagem aceita sale e sale_reversal", async () => {
    expect(isListableInventoryStockMovementType("sale")).toBe(true);
    expect(isListableInventoryStockMovementType("sale_reversal")).toBe(true);

    await ListInventoryStockMovementsService({ companyId: 7, type: "sale" });
    await ListInventoryStockMovementsService({
      companyId: 7,
      type: "sale_reversal"
    });

    expect(findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 7, type: "sale" })
      })
    );
    expect(findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 7,
          type: "sale_reversal"
        })
      })
    );
  });

  it("listagem continua aceitando os tipos manuais", async () => {
    await Promise.all(
      MANUAL_INVENTORY_STOCK_MOVEMENT_TYPES.map(async type => {
        expect(isListableInventoryStockMovementType(type)).toBe(true);
        await ListInventoryStockMovementsService({ companyId: 7, type });
        expect(findAndCountAll).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ companyId: 7, type })
          })
        );
      })
    );
    expect(LISTABLE_INVENTORY_STOCK_MOVEMENT_TYPES).toEqual([
      "in",
      "out",
      "adjustment",
      "initial",
      "sale",
      "sale_reversal"
    ]);
  });

  it("POST manual recusa sale e sale_reversal", async () => {
    expect(isInventoryStockMovementType("sale")).toBe(false);
    expect(isInventoryStockMovementType("sale_reversal")).toBe(false);

    await expect(
      CreateInventoryStockMovementService({
        companyId: 7,
        createdBy: 1,
        body: { productId: 1, type: "sale", quantity: 1 }
      })
    ).rejects.toMatchObject({
      clientMessage: "Tipo de movimentação inválido."
    });

    await expect(
      CreateInventoryStockMovementService({
        companyId: 7,
        createdBy: 1,
        body: { productId: 1, type: "sale_reversal", quantity: 1 }
      })
    ).rejects.toBeInstanceOf(AppError);
  });
});
