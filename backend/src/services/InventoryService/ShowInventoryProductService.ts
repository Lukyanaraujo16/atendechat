import InventoryCategory from "../../models/InventoryCategory";
import InventoryProduct from "../../models/InventoryProduct";
import { findInventoryProductOrThrow } from "./inventoryTenant";

export default async function ShowInventoryProductService(input: {
  companyId: number;
  id: number;
}): Promise<InventoryProduct> {
  const product = await findInventoryProductOrThrow(input.companyId, input.id);
  return product.reload({
    include: [
      {
        model: InventoryCategory,
        attributes: ["id", "name"],
        required: false
      }
    ]
  });
}
