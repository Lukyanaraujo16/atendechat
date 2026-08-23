import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySale from "../../models/InventorySale";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import { buildInventorySaleIncludes } from "./inventorySaleHelpers";
import { normalizeOptionalString, toInventoryQuantity } from "./inventoryTenant";

export default async function CancelInventorySaleService(input: {
  companyId: number;
  saleId: number;
  cancelledBy: number | null;
  cancelReason?: unknown;
}): Promise<InventorySale> {
  const cancelReason = normalizeOptionalString(input.cancelReason);
  if (!cancelReason) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "cancelReason é obrigatório."
    );
  }

  return sequelize.transaction(async (t: Transaction) => {
    const sale = await InventorySale.findOne({
      where: { id: input.saleId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!sale) {
      throw new AppError("ERR_INVENTORY_SALE_NOT_FOUND", 404);
    }

    if (sale.status === "cancelled") {
      throw new AppError(
        "ERR_INVENTORY_SALE_ALREADY_CANCELLED",
        400,
        "Venda já está cancelada."
      );
    }

    if (sale.status === "completed") {
      const existingReversal = await InventoryStockMovement.count({
        where: {
          companyId: input.companyId,
          referenceType: "sale",
          referenceId: sale.id,
          type: "sale_reversal"
        },
        transaction: t
      });
      if (existingReversal > 0) {
        throw new AppError(
          "ERR_INVENTORY_SALE_ALREADY_CANCELLED",
          400,
          "Estorno de estoque já registrado para esta venda."
        );
      }

      const items = await InventorySaleItem.findAll({
        where: { saleId: sale.id, companyId: input.companyId },
        transaction: t
      });

      for (const item of items) {
        if (!item.trackStock) continue;

        const product = await InventoryProduct.findOne({
          where: { id: item.productId, companyId: input.companyId },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!product) {
          throw new AppError("ERR_INVENTORY_PRODUCT_NOT_FOUND", 404);
        }

        const returnQty = Number(item.quantity);
        const currentQty = toInventoryQuantity(product.currentQuantity);
        const newBalance = currentQty + returnQty;

        await InventoryStockMovement.create(
          {
            companyId: input.companyId,
            productId: product.id,
            type: "sale_reversal",
            quantity: returnQty,
            balanceAfter: newBalance,
            unitCost: item.costPrice,
            referenceType: "sale",
            referenceId: sale.id,
            notes: `Cancelamento venda #${sale.saleNumber}`,
            createdBy: input.cancelledBy
          },
          { transaction: t }
        );

        await product.update({ currentQuantity: newBalance }, { transaction: t });
      }
    } else if (sale.status !== "draft") {
      throw new AppError(
        "ERR_INVENTORY_SALE_INVALID_STATUS",
        400,
        "Status da venda não permite cancelamento."
      );
    }

    await sale.update(
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: input.cancelledBy,
        cancelReason
      },
      { transaction: t }
    );

    return sale.reload({
      transaction: t,
      include: buildInventorySaleIncludes(input.companyId)
    });
  });
}
