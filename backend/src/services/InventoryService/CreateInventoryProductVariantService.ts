import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductAttribute from "../../models/InventoryProductAttribute";
import InventoryProductAttributeOption from "../../models/InventoryProductAttributeOption";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import InventoryProductVariantOption from "../../models/InventoryProductVariantOption";
import { isVariableProduct } from "./inventoryProductKind";
import {
  buildCombinationKey,
  buildVariantLabel,
  parseOptionIds
} from "./inventoryVariantCombination";
import { syncSellableCode } from "./inventorySellableCodes";
import {
  findInventoryProductOrThrow,
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal
} from "./inventoryTenant";
import CreateInventoryStockMovementService from "./CreateInventoryStockMovementService";

type CreateBody = {
  optionIds?: unknown;
  options?: unknown;
  label?: unknown;
  sku?: unknown;
  barcode?: unknown;
  salePrice?: unknown;
  costPrice?: unknown;
  trackStock?: unknown;
  currentQuantity?: unknown;
  minStock?: unknown;
  active?: unknown;
};

export default async function CreateInventoryProductVariantService(input: {
  companyId: number;
  productId: number;
  body: CreateBody;
  createdBy?: number | null;
}): Promise<InventoryProductVariant> {
  const product = await findInventoryProductOrThrow(
    input.companyId,
    input.productId
  );
  if (!isVariableProduct(product)) {
    throw new AppError(
      "ERR_INVENTORY_PRODUCT_NOT_VARIABLE",
      400,
      "Somente produtos com variações aceitam variantes."
    );
  }

  const optionInputs = parseOptionIds(input.body.optionIds ?? input.body.options);
  if (!optionInputs.length) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Informe ao menos uma opção de atributo."
    );
  }

  const resolved: Array<{
    attributeId: number;
    optionId: number;
    attributeName: string;
    optionValue: string;
  }> = [];

  for (const opt of optionInputs) {
    const attribute = await InventoryProductAttribute.findOne({
      where: { id: opt.attributeId, companyId: input.companyId, active: true }
    });
    if (!attribute) {
      throw new AppError("ERR_INVENTORY_ATTRIBUTE_NOT_FOUND", 404);
    }
    const option = await InventoryProductAttributeOption.findOne({
      where: {
        id: opt.optionId,
        companyId: input.companyId,
        attributeId: attribute.id,
        active: true
      }
    });
    if (!option) {
      throw new AppError("ERR_INVENTORY_ATTRIBUTE_OPTION_NOT_FOUND", 404);
    }
    resolved.push({
      attributeId: attribute.id,
      optionId: option.id,
      attributeName: attribute.name,
      optionValue: option.value
    });
  }

  const combinationKey = buildCombinationKey(resolved);
  const label =
    normalizeOptionalString(input.body.label, 200) ||
    buildVariantLabel(resolved);

  const salePrice = parseRequiredDecimal(input.body.salePrice, "salePrice");
  if (salePrice < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "salePrice inválido.");
  }
  const costPrice = parseDecimal(input.body.costPrice, "costPrice");
  if (costPrice !== null && costPrice < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "costPrice inválido.");
  }

  let currentQuantity = 0;
  if (
    input.body.currentQuantity !== undefined &&
    input.body.currentQuantity !== null &&
    input.body.currentQuantity !== ""
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

  const minStock = parseDecimal(input.body.minStock, "minStock");
  if (minStock !== null && minStock < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "minStock inválido.");
  }

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

  const sku = normalizeOptionalString(input.body.sku, 64);
  const barcode = normalizeOptionalString(input.body.barcode, 64);

  const variantId = await sequelize.transaction(async (t: Transaction) => {
    const dup = await InventoryProductVariant.findOne({
      where: {
        companyId: input.companyId,
        productId: product.id,
        combinationKey
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (dup) {
      throw new AppError(
        "ERR_INVENTORY_VARIANT_COMBINATION_DUPLICATE",
        400,
        "Já existe uma variante com esta combinação."
      );
    }

    const variant = await InventoryProductVariant.create(
      {
        companyId: input.companyId,
        productId: product.id,
        label,
        combinationKey,
        sku,
        barcode,
        salePrice,
        costPrice,
        trackStock,
        currentQuantity: 0,
        minStock,
        active
      },
      { transaction: t }
    );

    for (const row of resolved) {
      await InventoryProductVariantOption.create(
        {
          companyId: input.companyId,
          variantId: variant.id,
          attributeId: row.attributeId,
          optionId: row.optionId
        },
        { transaction: t }
      );
    }

    await syncSellableCode({
      companyId: input.companyId,
      codeType: "sku",
      codeValue: sku,
      productId: null,
      variantId: variant.id,
      transaction: t
    });
    await syncSellableCode({
      companyId: input.companyId,
      codeType: "barcode",
      codeValue: barcode,
      productId: null,
      variantId: variant.id,
      transaction: t
    });

    return variant.id;
  });

  if (trackStock && currentQuantity > 0) {
    await CreateInventoryStockMovementService({
      companyId: input.companyId,
      createdBy: input.createdBy ?? null,
      body: {
        productId: product.id,
        variantId,
        type: "initial",
        quantity: currentQuantity,
        notes: "Saldo inicial da variante"
      }
    });
  }

  return (await InventoryProductVariant.findOne({
    where: { id: variantId, companyId: input.companyId },
    include: [
      {
        model: InventoryProductVariantOption,
        as: "optionLinks",
        include: [
          {
            model: InventoryProductAttribute,
            as: "attribute",
            attributes: ["id", "name"]
          },
          {
            model: InventoryProductAttributeOption,
            as: "option",
            attributes: ["id", "value"]
          }
        ]
      }
    ]
  })) as InventoryProductVariant;
}
