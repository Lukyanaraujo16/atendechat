import { Transaction } from "sequelize";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryStockMovement from "../../models/InventoryStockMovement";

/**
 * Histórico que impede exclusão física do produto.
 * Identificadores de unidade ficam em InventorySaleItemIdentifiers (via saleItemId).
 */
export async function inventoryProductHasHistory(
  companyId: number,
  productId: number,
  transaction?: Transaction
): Promise<boolean> {
  const where = { companyId, productId };
  const query = { where, transaction, attributes: ["id"] };
  const [saleItem, movement] = await Promise.all([
    InventorySaleItem.findOne(query),
    InventoryStockMovement.findOne(query)
  ]);
  return Boolean(saleItem || movement);
}
