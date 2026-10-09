import InventoryCategory from "../../models/InventoryCategory";
import { findInventoryProductOrThrow } from "./inventoryTenant";
import { enrichInventoryProducts } from "./inventoryProductListEnrichment";
import ListInventoryProductVariantsService from "./ListInventoryProductVariantsService";

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
      }
    ]
  });
  const [enriched] = await enrichInventoryProducts(input.companyId, [full]);
  const variants = await ListInventoryProductVariantsService({
    companyId: input.companyId,
    productId: input.id
  });
  return {
    ...enriched,
    variants
  };
}
