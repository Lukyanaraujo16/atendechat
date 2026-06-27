import AppError from "../../errors/AppError";
import InventorySaleItem from "../../models/InventorySaleItem";
import {
  assertInventorySaleIsDraft,
  findInventorySaleOrThrow,
  recalculateInventorySaleTotals
} from "./inventorySaleHelpers";

export default async function DeleteInventorySaleItemService(input: {
  companyId: number;
  saleId: number;
  itemId: number;
}): Promise<void> {
  const sale = await findInventorySaleOrThrow(input.companyId, input.saleId);
  assertInventorySaleIsDraft(sale, "ter itens removidos");

  const item = await InventorySaleItem.findOne({
    where: { id: input.itemId, saleId: input.saleId, companyId: input.companyId }
  });
  if (!item) {
    throw new AppError("ERR_INVENTORY_SALE_ITEM_NOT_FOUND", 404);
  }

  await item.destroy();
  await recalculateInventorySaleTotals(sale.id, input.companyId);
}
