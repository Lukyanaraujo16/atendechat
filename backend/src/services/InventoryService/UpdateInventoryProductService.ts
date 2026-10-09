import { Transaction } from "sequelize";
import sequelize from "../../database";
import {
  assertInventoryBarcodeUnique,
  rethrowInventoryBarcodeConstraint
} from "./inventoryBarcode";
import AppError from "../../errors/AppError";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import { resolveInventoryProductUnitForUpdate } from "./inventoryProductUnit";
import {
  assertInventoryCategoryBelongsToCompany,
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal,
  toInventoryQuantity
} from "./inventoryTenant";
import {
  INVENTORY_PRODUCT_KIND_SIMPLE,
  INVENTORY_PRODUCT_KIND_VARIABLE,
  isVariableProduct,
  normalizeInventoryProductKind
} from "./inventoryProductKind";
import { syncSellableCode } from "./inventorySellableCodes";

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
  productKind?: unknown;
};

export default async function UpdateInventoryProductService(input: {
  companyId: number;
  id: number;
  body: UpdateBody;
}): Promise<InventoryProduct> {
  return sequelize.transaction(async (t: Transaction) => {
  const product = await InventoryProduct.findOne({
    where: { id: input.id, companyId: input.companyId },
    transaction: t,
    lock: t.LOCK.UPDATE
  });
  if (!product) {
    throw new AppError("ERR_INVENTORY_PRODUCT_NOT_FOUND", 404);
  }
  const patch: Partial<InventoryProduct> = {};

  if (input.body.currentQuantity !== undefined) {
    throw new AppError(
      "ERR_INVENTORY_PRODUCT_QUANTITY_LOCKED",
      400,
      "A quantidade em estoque só pode ser alterada por movimentações de estoque."
    );
  }

  if (input.body.productKind !== undefined) {
    const nextKind = normalizeInventoryProductKind(input.body.productKind);
    const prevKind = normalizeInventoryProductKind(product.productKind);
    if (nextKind !== prevKind) {
      if (
        nextKind === INVENTORY_PRODUCT_KIND_VARIABLE &&
        prevKind === INVENTORY_PRODUCT_KIND_SIMPLE
      ) {
        const [saleCount, moveCount, qty] = await Promise.all([
          InventorySaleItem.count({
            where: { companyId: input.companyId, productId: product.id },
            transaction: t
          }),
          InventoryStockMovement.count({
            where: { companyId: input.companyId, productId: product.id },
            transaction: t
          }),
          Promise.resolve(toInventoryQuantity(product.currentQuantity))
        ]);
        if (saleCount > 0 || moveCount > 0 || qty > 0) {
          throw new AppError(
            "ERR_INVENTORY_PRODUCT_KIND_CONVERSION_BLOCKED",
            400,
            "Não é possível converter produto com histórico/estoque em produto com variações."
          );
        }
        patch.productKind = INVENTORY_PRODUCT_KIND_VARIABLE;
        patch.sku = null;
        patch.barcode = null;
        patch.trackStock = false;
        patch.currentQuantity = 0;
        patch.minStock = null;
        await syncSellableCode({
          companyId: input.companyId,
          codeType: "sku",
          codeValue: null,
          productId: product.id,
          variantId: null,
          transaction: t
        });
        await syncSellableCode({
          companyId: input.companyId,
          codeType: "barcode",
          codeValue: null,
          productId: product.id,
          variantId: null,
          transaction: t
        });
      } else if (
        nextKind === INVENTORY_PRODUCT_KIND_SIMPLE &&
        prevKind === INVENTORY_PRODUCT_KIND_VARIABLE
      ) {
        const variantCount = await InventoryProductVariant.count({
          where: { companyId: input.companyId, productId: product.id },
          transaction: t
        });
        if (variantCount > 0) {
          throw new AppError(
            "ERR_INVENTORY_PRODUCT_KIND_CONVERSION_BLOCKED",
            400,
            "Remova/desative todas as variantes antes de converter para produto simples."
          );
        }
        patch.productKind = INVENTORY_PRODUCT_KIND_SIMPLE;
      }
    }
  }

  const variable = isVariableProduct({
    productKind: (patch.productKind as string) || product.productKind
  });

  if (input.body.categoryId !== undefined) {
    if (input.body.categoryId === null || input.body.categoryId === "") {
      patch.categoryId = null;
    } else {
      const categoryId = Number(input.body.categoryId);
      if (!Number.isFinite(categoryId)) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "categoryId inválido.");
      }
      await assertInventoryCategoryBelongsToCompany(
        input.companyId,
        categoryId
      );
      patch.categoryId = categoryId;
    }
  }

  if (!variable && input.body.sku !== undefined) {
    const sku = normalizeOptionalString(input.body.sku, 64);
    patch.sku = sku;
    await syncSellableCode({
      companyId: input.companyId,
      codeType: "sku",
      codeValue: sku,
      productId: product.id,
      variantId: null,
      transaction: t
    });
  }

  if (!variable && input.body.barcode !== undefined) {
    const barcode = normalizeOptionalString(input.body.barcode, 64);
    patch.barcode = barcode;
    await assertInventoryBarcodeUnique(input.companyId, barcode, product.id);
    await syncSellableCode({
      companyId: input.companyId,
      codeType: "barcode",
      codeValue: barcode,
      productId: product.id,
      variantId: null,
      transaction: t
    });
  }

  if (input.body.name !== undefined) {
    const name = normalizeOptionalString(input.body.name, 200);
    if (!name) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Nome do produto é obrigatório."
      );
    }
    patch.name = name;
  }

  if (input.body.description !== undefined) {
    patch.description = normalizeOptionalString(input.body.description);
  }

  if (input.body.unit !== undefined) {
    patch.unit = resolveInventoryProductUnitForUpdate(
      input.body.unit,
      product.unit
    );
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

  try {
    await product.update(patch, { transaction: t });
  } catch (error) {
    rethrowInventoryBarcodeConstraint(error);
  }
  return product.reload({ transaction: t });
  });
}
