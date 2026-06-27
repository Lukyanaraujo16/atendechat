import InventoryProduct from "../../models/InventoryProduct";
import { findInventoryProductOrThrow } from "./inventoryTenant";

/** Soft delete — preserva histórico futuro de vendas/estoque. */
export default async function DeleteInventoryProductService(input: {
  companyId: number;
  id: number;
}): Promise<InventoryProduct> {
  const product = await findInventoryProductOrThrow(input.companyId, input.id);
  await product.update({ active: false });
  return product.reload();
}
