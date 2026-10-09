import InventoryCategory from "../../models/InventoryCategory";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import { findInventoryProductOrThrow } from "./inventoryTenant";
import { enrichInventoryProducts } from "./inventoryProductListEnrichment";

export default async function ShowInventoryProductService(input: {
  companyId: number;
  id: number;
}): Promise<any> {
  const product = await findInventoryProductOrThrow(input.companyId, input.id);
  const full = await product.reload({
    include: [
      {
        model: InventoryCategory,
        attributes: ["id", "name"],
        required: false
      },
      {
        model: InventoryProductVariant,
        required: false
      }
    ]
  });
  const [enriched] = await enrichInventoryProducts(input.companyId, [full]);
  return {
    ...enriched,
    variants: full.variants || []
  };
}
