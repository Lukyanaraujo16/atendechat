import { Transaction } from "sequelize";
import sequelize from "../../database";
import {
  assertInventoryBarcodeUnique,
  rethrowInventoryBarcodeConstraint
} from "./inventoryBarcode";
import AppError from "../../errors/AppError";
import InventoryProduct from "../../models/InventoryProduct";
import { assertNewInventoryProductUnit } from "./inventoryProductUnit";
import {
  assertInventoryCategoryBelongsToCompany,
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal
} from "./inventoryTenant";
import {
  INVENTORY_PRODUCT_KIND_VARIABLE,
  normalizeInventoryProductKind
} from "./inventoryProductKind";
import { syncSellableCode } from "./inventorySellableCodes";

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
  productKind?: unknown;
};

export default async function CreateInventoryProductService(input: {
  companyId: number;
  body: CreateBody;
}): Promise<InventoryProduct> {
  const name = normalizeOptionalString(input.body.name, 200);
  if (!name) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Nome do produto é obrigatório."
    );
  }

  const unit =
    input.body.unit === undefined || input.body.unit === null
      ? "un"
      : assertNewInventoryProductUnit(input.body.unit);

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

  const productKind = normalizeInventoryProductKind(input.body.productKind);
  const isVariable = productKind === INVENTORY_PRODUCT_KIND_VARIABLE;

  // Produto variável: códigos/estoque comerciais ficam nas variantes.
  const sku = isVariable ? null : normalizeOptionalString(input.body.sku, 64);
  const barcode = isVariable
    ? null
    : normalizeOptionalString(input.body.barcode, 64);

  if (!isVariable) {
    await assertInventoryBarcodeUnique(input.companyId, barcode);
  }

  const salePrice = isVariable
    ? 0
    : parseRequiredDecimal(input.body.salePrice, "salePrice");
  if (salePrice < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "salePrice inválido.");
  }

  const costPrice = parseDecimal(input.body.costPrice, "costPrice");
  if (costPrice !== null && costPrice < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "costPrice inválido.");
  }

  let currentQuantity = 0;
  if (
    !isVariable &&
    input.body.currentQuantity !== undefined &&
    input.body.currentQuantity !== null
  ) {
    currentQuantity = parseRequiredDecimal(
      input.body.currentQuantity,
      "currentQuantity"
    );
    if (currentQuantity < 0) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "currentQuantity inválido."
      );
    }
  }

  const minStock = isVariable
    ? null
    : parseDecimal(input.body.minStock, "minStock");
  if (minStock !== null && minStock < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "minStock inválido.");
  }

  const trackStock = isVariable
    ? false
    : input.body.trackStock === undefined
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

  try {
    return await sequelize.transaction(async (t: Transaction) => {
      const product = await InventoryProduct.create(
        {
          companyId: input.companyId,
          categoryId,
          productKind,
          sku,
          barcode,
          name,
          description: normalizeOptionalString(input.body.description),
          unit,
          salePrice,
          costPrice: isVariable ? null : costPrice,
          trackStock,
          currentQuantity: isVariable ? 0 : currentQuantity,
          minStock,
          imageUrl: normalizeOptionalString(input.body.imageUrl, 500),
          active
        },
        { transaction: t }
      );

      if (!isVariable) {
        await syncSellableCode({
          companyId: input.companyId,
          codeType: "sku",
          codeValue: sku,
          productId: product.id,
          variantId: null,
          transaction: t
        });
        await syncSellableCode({
          companyId: input.companyId,
          codeType: "barcode",
          codeValue: barcode,
          productId: product.id,
          variantId: null,
          transaction: t
        });
      }

      return product;
    });
  } catch (error) {
    return rethrowInventoryBarcodeConstraint(error);
  }
}
