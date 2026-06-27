import InventoryCategory from "../../models/InventoryCategory";
import { findInventoryCategoryOrThrow } from "./inventoryTenant";

/** Soft delete — preserva histórico e produtos vinculados. */
export default async function DeleteInventoryCategoryService(input: {
  companyId: number;
  id: number;
}): Promise<InventoryCategory> {
  const category = await findInventoryCategoryOrThrow(input.companyId, input.id);
  await category.update({ active: false });
  return category.reload();
}
