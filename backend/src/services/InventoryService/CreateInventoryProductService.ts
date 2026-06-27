import AppError from "../../errors/AppError";
import InventoryProduct from "../../models/InventoryProduct";
import {
  assertInventoryCategoryBelongsToCompany,
  assertInventoryProductSkuUnique,
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal
} from "./inventoryTenant";

type CreateBody = {
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

export default async function CreateInventoryProductService(input: {
  companyId: number;
  body: CreateBody;
}): Promise<InventoryProduct> {
  const name = normalizeOptionalString(input.body.name, 200);
  if (!name) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Nome do produto é obrigatório.");
  }

  let categoryId: number | null = null;
  if (
    input.body.categoryId !== undefined &&
    input.body.categoryId !== null &&
    input.body.categoryId !== ""
  ) {
    categoryId = Number(input.body.categoryId);
    if (!Number.isFinite(categoryId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "categoryId inválido.");
    }
    await assertInventoryCategoryBelongsToCompany(input.companyId, categoryId);
  }

  const sku = normalizeOptionalString(input.body.sku, 64);
  await assertInventoryProductSkuUnique(input.companyId, sku);

  const salePrice = parseRequiredDecimal(input.body.salePrice, "salePrice");
  if (salePrice < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "salePrice inválido.");
  }

  const costPrice = parseDecimal(input.body.costPrice, "costPrice");
  if (costPrice !== null && costPrice < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "costPrice inválido.");
  }

  let currentQuantity = 0;
  if (input.body.currentQuantity !== undefined && input.body.currentQuantity !== null) {
    currentQuantity = parseRequiredDecimal(input.body.currentQuantity, "currentQuantity");
    if (currentQuantity < 0) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "currentQuantity inválido.");
    }
  }

  const minStock = parseDecimal(input.body.minStock, "minStock");
  if (minStock !== null && minStock < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "minStock inválido.");
  }

  const unit = normalizeOptionalString(input.body.unit, 16) || "un";

  const trackStock =
    input.body.trackStock === undefined
      ? true
      : input.body.trackStock === true ||
        input.body.trackStock === "true" ||
        input.body.trackStock === 1 ||
        input.body.trackStock === "1";

  const active =
    input.body.active === undefined
      ? true
      : input.body.active === true ||
        input.body.active === "true" ||
        input.body.active === 1 ||
        input.body.active === "1";

  return InventoryProduct.create({
    companyId: input.companyId,
    categoryId,
    sku,
    barcode: normalizeOptionalString(input.body.barcode, 64),
    name,
    description: normalizeOptionalString(input.body.description),
    unit,
    salePrice,
    costPrice,
    trackStock,
    currentQuantity,
    minStock,
    imageUrl: normalizeOptionalString(input.body.imageUrl, 500),
    active
  });
}
