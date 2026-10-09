import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import InventoryProductVariantOption from "../../models/InventoryProductVariantOption";
import InventoryProductAttribute from "../../models/InventoryProductAttribute";
import InventoryProductAttributeOption from "../../models/InventoryProductAttributeOption";
import { syncSellableCode } from "./inventorySellableCodes";
import {
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal
} from "./inventoryTenant";

type UpdateBody = {
  label?: unknown;
  sku?: unknown;
  barcode?: unknown;
  imageUrl?: unknown;
  salePrice?: unknown;
  costPrice?: unknown;
  trackStock?: unknown;
  minStock?: unknown;
  active?: unknown;
};

export default async function UpdateInventoryProductVariantService(input: {
  companyId: number;
  productId: number;
  variantId: number;
  body: UpdateBody;
}): Promise<InventoryProductVariant> {
  return sequelize.transaction(async (t: Transaction) => {
    const variant = await InventoryProductVariant.findOne({
      where: {
        id: input.variantId,
        companyId: input.companyId,
        productId: input.productId
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!variant) {
      throw new AppError("ERR_INVENTORY_VARIANT_NOT_FOUND", 404);
    }

    const patch: Record<string, unknown> = {};

    if (input.body.label !== undefined) {
      const label = normalizeOptionalString(input.body.label, 200);
      if (!label) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "label inválido.");
      }
      patch.label = label;
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

    if (input.body.sku !== undefined) {
      const sku = normalizeOptionalString(input.body.sku, 64);
      patch.sku = sku;
      await syncSellableCode({
        companyId: input.companyId,
        codeType: "sku",
        codeValue: sku,
        productId: null,
        variantId: variant.id,
        transaction: t
      });
    }

    if (input.body.barcode !== undefined) {
      const barcode = normalizeOptionalString(input.body.barcode, 64);
      patch.barcode = barcode;
      await syncSellableCode({
        companyId: input.companyId,
        codeType: "barcode",
        codeValue: barcode,
        productId: null,
        variantId: variant.id,
        transaction: t
      });
    }

    if (input.body.imageUrl !== undefined) {
      patch.imageUrl = normalizeOptionalString(input.body.imageUrl, 500);
    }

    if (Object.keys(patch).length) {
      await variant.update(patch, { transaction: t });
    }

    return variant.reload({
      transaction: t,
      include: [
        {
          model: InventoryProductVariantOption,
          include: [
            { model: InventoryProductAttribute, attributes: ["id", "name"] },
            {
              model: InventoryProductAttributeOption,
              attributes: ["id", "value"]
            }
          ]
        }
      ]
    });
  });
}
