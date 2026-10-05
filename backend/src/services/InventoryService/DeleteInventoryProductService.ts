import { ForeignKeyConstraintError } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import InventoryProduct from "../../models/InventoryProduct";
import { inventoryProductHasHistory } from "./inventoryProductHistory";

/** Exclusão definitiva — só quando não há vendas nem movimentações vinculadas. */
export default async function DeleteInventoryProductService(input: {
  companyId: number;
  id: number;
}): Promise<void> {
  await sequelize.transaction(async transaction => {
    const product = await InventoryProduct.findOne({
      where: { id: input.id, companyId: input.companyId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!product) {
      throw new AppError("ERR_INVENTORY_PRODUCT_NOT_FOUND", 404);
    }
    if (
      await inventoryProductHasHistory(input.companyId, product.id, transaction)
    ) {
      throw new AppError("ERR_INVENTORY_PRODUCT_HAS_HISTORY", 400);
    }
    try {
      await product.destroy({ transaction });
    } catch (err) {
      if (err instanceof ForeignKeyConstraintError) {
        throw new AppError("ERR_INVENTORY_PRODUCT_HAS_HISTORY", 400);
      }
      throw err;
    }
  });
}
