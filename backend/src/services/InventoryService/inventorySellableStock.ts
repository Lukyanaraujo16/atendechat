import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import { isVariableProduct } from "./inventoryProductKind";
import { toInventoryQuantity } from "./inventoryTenant";

export type SellableStockTarget =
  | {
      kind: "simple";
      product: InventoryProduct;
      variant: null;
      trackStock: boolean;
      currentQuantity: number;
    }
  | {
      kind: "variant";
      product: InventoryProduct;
      variant: InventoryProductVariant;
      trackStock: boolean;
      currentQuantity: number;
    };

/** Locka e resolve a unidade vendável (produto simples ou variante). */
export async function lockSellableStockTarget(input: {
  companyId: number;
  productId: number;
  variantId?: number | null;
  transaction: Transaction;
  requireActive?: boolean;
}): Promise<SellableStockTarget> {
  const { companyId, productId, transaction } = input;
  const requireActive = input.requireActive !== false;
  const variantId =
    input.variantId != null && Number.isFinite(Number(input.variantId))
      ? Number(input.variantId)
      : null;

  const product = await InventoryProduct.findOne({
    where: { id: productId, companyId },
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (!product) {
    throw new AppError("ERR_INVENTORY_PRODUCT_NOT_FOUND", 404);
  }

  if (isVariableProduct(product)) {
    if (variantId == null) {
      throw new AppError(
        "ERR_INVENTORY_VARIANT_REQUIRED",
        400,
        "Produto com variações exige seleção de variante."
      );
    }
    const variant = await InventoryProductVariant.findOne({
      where: { id: variantId, companyId, productId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!variant) {
      throw new AppError("ERR_INVENTORY_VARIANT_NOT_FOUND", 404);
    }
    if (requireActive && (!product.active || !variant.active)) {
      throw new AppError(
        "ERR_INVENTORY_VARIANT_INACTIVE",
        400,
        "Variante inativa não aceita esta operação."
      );
    }
    return {
      kind: "variant",
      product,
      variant,
      trackStock: variant.trackStock === true,
      currentQuantity: toInventoryQuantity(variant.currentQuantity)
    };
  }

  if (variantId != null) {
    throw new AppError(
      "ERR_INVENTORY_VARIANT_NOT_ALLOWED",
      400,
      "Produto simples não aceita variantId."
    );
  }
  if (requireActive && !product.active) {
    throw new AppError(
      "ERR_INVENTORY_PRODUCT_INACTIVE",
      400,
      "Produto inativo não aceita esta operação."
    );
  }
  return {
    kind: "simple",
    product,
    variant: null,
    trackStock: product.trackStock === true,
    currentQuantity: toInventoryQuantity(product.currentQuantity)
  };
}

export async function applySellableQuantity(
  target: SellableStockTarget,
  newBalance: number,
  transaction: Transaction
): Promise<void> {
  if (target.kind === "variant") {
    await target.variant.update(
      { currentQuantity: newBalance },
      { transaction }
    );
    return;
  }
  await target.product.update({ currentQuantity: newBalance }, { transaction });
}
