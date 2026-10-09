import { Transaction, UniqueConstraintError } from "sequelize";
import AppError from "../../errors/AppError";
import InventorySellableCode from "../../models/InventorySellableCode";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductVariant from "../../models/InventoryProductVariant";

export type SellableCodeType = "sku" | "barcode";

export function normalizeSellableCode(value: unknown): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t ? t : null;
}

function duplicateError(codeType: SellableCodeType): AppError {
  return new AppError(
    codeType === "barcode"
      ? "ERR_INVENTORY_PRODUCT_BARCODE_DUPLICATE"
      : "ERR_INVENTORY_PRODUCT_SKU_DUPLICATE",
    400
  );
}

function sameOwner(
  row: InventorySellableCode,
  productId: number | null,
  variantId: number | null
): boolean {
  if (variantId != null) {
    return Number(row.variantId) === Number(variantId);
  }
  return (
    row.variantId == null &&
    productId != null &&
    Number(row.productId) === Number(productId)
  );
}

/**
 * Unicidade cruzada simples↔variante via InventorySellableCodes (transacional).
 */
export async function syncSellableCode(input: {
  companyId: number;
  codeType: SellableCodeType;
  codeValue: string | null;
  productId?: number | null;
  variantId?: number | null;
  transaction: Transaction;
}): Promise<void> {
  const codeValue = normalizeSellableCode(input.codeValue);
  const { companyId, codeType, transaction } = input;
  const productId = input.productId ?? null;
  const variantId = input.variantId ?? null;

  const ownerWhere =
    variantId != null
      ? { companyId, codeType, variantId }
      : { companyId, codeType, productId, variantId: null as null };

  const owned = await InventorySellableCode.findAll({
    where: ownerWhere,
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  if (!codeValue) {
    for (const row of owned) {
      await row.destroy({ transaction });
    }
    return;
  }

  const occupant = await InventorySellableCode.findOne({
    where: { companyId, codeType, codeValue },
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  if (occupant && !sameOwner(occupant, productId, variantId)) {
    throw duplicateError(codeType);
  }

  if (owned.length) {
    const primary = owned[0];
    await primary.update({ codeValue, productId, variantId }, { transaction });
    for (const extra of owned.slice(1)) {
      await extra.destroy({ transaction });
    }
    return;
  }

  if (occupant && sameOwner(occupant, productId, variantId)) {
    return;
  }

  try {
    await InventorySellableCode.create(
      { companyId, codeType, codeValue, productId, variantId },
      { transaction }
    );
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw duplicateError(codeType);
    }
    throw err;
  }
}

export async function clearSellableCodesForVariant(
  companyId: number,
  variantId: number,
  transaction: Transaction
): Promise<void> {
  await InventorySellableCode.destroy({
    where: { companyId, variantId },
    transaction
  });
}

export async function resolveSellableByCode(input: {
  companyId: number;
  codeType: SellableCodeType;
  codeValue: string;
}): Promise<
  | { kind: "simple"; product: InventoryProduct }
  | {
      kind: "variant";
      product: InventoryProduct;
      variant: InventoryProductVariant;
    }
  | null
> {
  const codeValue = normalizeSellableCode(input.codeValue);
  if (!codeValue) return null;

  const row = await InventorySellableCode.findOne({
    where: {
      companyId: input.companyId,
      codeType: input.codeType,
      codeValue
    }
  });
  if (!row) return null;

  if (row.variantId != null) {
    const variant = await InventoryProductVariant.findOne({
      where: { id: row.variantId, companyId: input.companyId }
    });
    if (!variant) return null;
    const product = await InventoryProduct.findOne({
      where: { id: variant.productId, companyId: input.companyId }
    });
    if (!product) return null;
    return { kind: "variant", product, variant };
  }

  if (row.productId == null) return null;
  const product = await InventoryProduct.findOne({
    where: { id: row.productId, companyId: input.companyId }
  });
  if (!product) return null;
  return { kind: "simple", product };
}
