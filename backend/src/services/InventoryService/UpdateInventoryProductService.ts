import AppError from "../../errors/AppError";
import InventoryProduct from "../../models/InventoryProduct";
import {
  assertInventoryCategoryBelongsToCompany,
  assertInventoryProductSkuUnique,
  findInventoryProductOrThrow,
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal
} from "./inventoryTenant";

type UpdateBody = {
  categoryId?: unknown;
  sku?: unknown;
  barcode?: unknown;
  name?: unknown;
  description?: unknown;
  unit?: unknown;
  salePrice?: unknown;
  costPrice?: unknown;
  trackStock?: unknown;
  currentQuantity?: unknown;
  minStock?: unknown;
  imageUrl?: unknown;
  active?: unknown;
};

export default async function UpdateInventoryProductService(input: {
  companyId: number;
  id: number;
  body: UpdateBody;
}): Promise<InventoryProduct> {
  const product = await findInventoryProductOrThrow(input.companyId, input.id);
  const patch: Partial<InventoryProduct> = {};

  if (input.body.currentQuantity !== undefined) {
    throw new AppError(
      "ERR_INVENTORY_PRODUCT_QUANTITY_LOCKED",
      400,
      "A quantidade em estoque só pode ser alterada por movimentações de estoque."
    );
  }

  if (input.body.categoryId !== undefined) {
    if (input.body.categoryId === null || input.body.categoryId === "") {
      patch.categoryId = null;
    } else {
      const categoryId = Number(input.body.categoryId);
      if (!Number.isFinite(categoryId)) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "categoryId inválido.");
      }
      await assertInventoryCategoryBelongsToCompany(input.companyId, categoryId);
      patch.categoryId = categoryId;
    }
  }

  if (input.body.sku !== undefined) {
    const sku = normalizeOptionalString(input.body.sku, 64);
    await assertInventoryProductSkuUnique(input.companyId, sku, product.id);
    patch.sku = sku;
  }

  if (input.body.barcode !== undefined) {
    patch.barcode = normalizeOptionalString(input.body.barcode, 64);
  }

  if (input.body.name !== undefined) {
    const name = normalizeOptionalString(input.body.name, 200);
    if (!name) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "Nome do produto é obrigatório.");
    }
    patch.name = name;
  }

  if (input.body.description !== undefined) {
    patch.description = normalizeOptionalString(input.body.description);
  }

  if (input.body.unit !== undefined) {
    const unit = normalizeOptionalString(input.body.unit, 16);
    if (!unit) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "unit inválido.");
    }
    patch.unit = unit;
  }

  if (input.body.salePrice !== undefined) {
    const salePrice = parseRequiredDecimal(input.body.salePrice, "salePrice");
    if (salePrice < 0) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "salePrice inválido.");
    }
    patch.salePrice = salePrice;
  }

  if (input.body.costPrice !== undefined) {
    const costPrice = parseDecimal(input.body.costPrice, "costPrice");
    if (costPrice !== null && costPrice < 0) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "costPrice inválido.");
    }
    patch.costPrice = costPrice;
  }

  if (input.body.minStock !== undefined) {
    const minStock = parseDecimal(input.body.minStock, "minStock");
    if (minStock !== null && minStock < 0) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "minStock inválido.");
    }
    patch.minStock = minStock;
  }

  if (input.body.imageUrl !== undefined) {
    patch.imageUrl = normalizeOptionalString(input.body.imageUrl, 500);
  }

  if (input.body.trackStock !== undefined) {
    patch.trackStock =
      input.body.trackStock === true ||
      input.body.trackStock === "true" ||
      input.body.trackStock === 1 ||
      input.body.trackStock === "1";
  }

  if (input.body.active !== undefined) {
    patch.active =
      input.body.active === true ||
      input.body.active === "true" ||
      input.body.active === 1 ||
      input.body.active === "1";
  }

  if (Object.keys(patch).length === 0) {
    return product;
  }

  await product.update(patch);
  return product.reload();
}
