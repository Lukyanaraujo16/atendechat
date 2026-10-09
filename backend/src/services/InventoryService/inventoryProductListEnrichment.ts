import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import { isVariableProduct } from "./inventoryProductKind";
import { toInventoryQuantity } from "./inventoryTenant";

export type EnrichedInventoryProduct = InventoryProduct & {
  variantCount?: number;
  activeVariantCount?: number;
  aggregatedQuantity?: number;
  priceMin?: number | null;
  priceMax?: number | null;
  selectedVariant?: InventoryProductVariant | null;
  sellable?: boolean;
};

export async function enrichInventoryProducts(
  companyId: number,
  products: InventoryProduct[]
): Promise<EnrichedInventoryProduct[]> {
  if (!products.length) return [];

  const variableIds = products
    .filter(p => isVariableProduct(p))
    .map(p => p.id);

  const aggregates = new Map<
    number,
    {
      variantCount: number;
      activeVariantCount: number;
      aggregatedQuantity: number;
      priceMin: number | null;
      priceMax: number | null;
    }
  >();

  if (variableIds.length) {
    const variants = await InventoryProductVariant.findAll({
      where: { companyId, productId: variableIds },
      attributes: [
        "productId",
        "active",
        "currentQuantity",
        "salePrice",
        "trackStock"
      ]
    });

    for (const v of variants) {
      const cur = aggregates.get(v.productId) || {
        variantCount: 0,
        activeVariantCount: 0,
        aggregatedQuantity: 0,
        priceMin: null as number | null,
        priceMax: null as number | null
      };
      cur.variantCount += 1;
      if (v.active) {
        cur.activeVariantCount += 1;
        const price = Number(v.salePrice);
        if (Number.isFinite(price)) {
          cur.priceMin =
            cur.priceMin == null ? price : Math.min(cur.priceMin, price);
          cur.priceMax =
            cur.priceMax == null ? price : Math.max(cur.priceMax, price);
        }
        if (v.trackStock) {
          cur.aggregatedQuantity += toInventoryQuantity(v.currentQuantity);
        }
      }
      aggregates.set(v.productId, cur);
    }
  }

  return products.map(product => {
    const json = product.toJSON() as EnrichedInventoryProduct;
    if (isVariableProduct(product)) {
      const agg = aggregates.get(product.id) || {
        variantCount: 0,
        activeVariantCount: 0,
        aggregatedQuantity: 0,
        priceMin: null,
        priceMax: null
      };
      json.variantCount = agg.variantCount;
      json.activeVariantCount = agg.activeVariantCount;
      json.aggregatedQuantity = agg.aggregatedQuantity;
      json.priceMin = agg.priceMin;
      json.priceMax = agg.priceMax;
      json.sellable = false;
      json.currentQuantity = agg.aggregatedQuantity;
    } else {
      json.variantCount = 0;
      json.activeVariantCount = 0;
      json.aggregatedQuantity = toInventoryQuantity(product.currentQuantity);
      json.priceMin = Number(product.salePrice);
      json.priceMax = Number(product.salePrice);
      json.sellable = true;
    }
    return json;
  });
}
