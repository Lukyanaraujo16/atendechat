import { Transaction, UniqueConstraintError } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductAttribute from "../../models/InventoryProductAttribute";
import InventoryProductAttributeOption from "../../models/InventoryProductAttributeOption";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import InventoryProductVariantOption from "../../models/InventoryProductVariantOption";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import { assertNewInventoryProductUnit } from "./inventoryProductUnit";
import {
  INVENTORY_PRODUCT_KIND_VARIABLE,
  isVariableProduct
} from "./inventoryProductKind";
import {
  buildCombinationKey,
  buildVariantLabel
} from "./inventoryVariantCombination";
import {
  clearSellableCodesForVariant,
  syncSellableCode
} from "./inventorySellableCodes";
import {
  assertInventoryCategoryBelongsToCompany,
  findInventoryProductOrThrow,
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal
} from "./inventoryTenant";
import CreateInventoryStockMovementService from "./CreateInventoryStockMovementService";
import ShowInventoryProductService from "./ShowInventoryProductService";
import ListInventoryProductVariantsService from "./ListInventoryProductVariantsService";

const MAX_VARIANTS_PER_SAVE = 64;

type CharacteristicInput = {
  name?: unknown;
  options?: unknown;
};

type VariantOptionRef = {
  characteristicName?: unknown;
  optionValue?: unknown;
};

type VariantInput = {
  id?: unknown;
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

type ProductBody = {
  categoryId?: unknown;
  name?: unknown;
  description?: unknown;
  unit?: unknown;
  imageUrl?: unknown;
  active?: unknown;
  characteristics?: unknown;
  variants?: unknown;
};

async function findOrCreateAttribute(
  companyId: number,
  name: string,
  position: number,
  transaction: Transaction
): Promise<InventoryProductAttribute> {
  const existing = await InventoryProductAttribute.findOne({
    where: { companyId, name },
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (existing) {
    if (!existing.active) {
      await existing.update({ active: true }, { transaction });
    }
    return existing;
  }
  try {
    return await InventoryProductAttribute.create(
      { companyId, name, position, active: true },
      { transaction }
    );
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const again = await InventoryProductAttribute.findOne({
        where: { companyId, name },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (again) return again;
    }
    throw err;
  }
}

async function findOrCreateOption(
  companyId: number,
  attributeId: number,
  value: string,
  position: number,
  transaction: Transaction
): Promise<InventoryProductAttributeOption> {
  const existing = await InventoryProductAttributeOption.findOne({
    where: { companyId, attributeId, value },
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (existing) {
    if (!existing.active) {
      await existing.update({ active: true }, { transaction });
    }
    return existing;
  }
  try {
    return await InventoryProductAttributeOption.create(
      {
        companyId,
        attributeId,
        value,
        position,
        active: true
      },
      { transaction }
    );
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const again = await InventoryProductAttributeOption.findOne({
        where: { companyId, attributeId, value },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (again) return again;
    }
    throw err;
  }
}

function parseCharacteristics(raw: unknown): Array<{
  name: string;
  options: string[];
}> {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Informe ao menos uma característica (ex.: Cor)."
    );
  }
  if (raw.length > 6) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Use no máximo 6 características por produto."
    );
  }
  const out: Array<{ name: string; options: string[] }> = [];
  const seenNames = new Set<string>();
  for (const row of raw as CharacteristicInput[]) {
    const name = normalizeOptionalString(row?.name, 80);
    if (!name) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Informe o nome da característica."
      );
    }
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `Característica duplicada: ${name}.`
      );
    }
    seenNames.add(key);
    if (!Array.isArray(row?.options) || row.options.length === 0) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `Informe opções para a característica ${name}.`
      );
    }
    const options: string[] = [];
    const seenOpts = new Set<string>();
    for (const optRaw of row.options) {
      const value = normalizeOptionalString(optRaw, 120);
      if (!value) continue;
      const optKey = value.toLowerCase();
      if (seenOpts.has(optKey)) continue;
      seenOpts.add(optKey);
      options.push(value);
    }
    if (!options.length) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `Informe opções para a característica ${name}.`
      );
    }
    if (options.length > 30) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `A característica ${name} tem opções demais (máx. 30).`
      );
    }
    out.push({ name, options });
  }
  return out;
}

function parseVariantRows(raw: unknown): VariantInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Selecione ao menos uma variação."
    );
  }
  if (raw.length > MAX_VARIANTS_PER_SAVE) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `No máximo ${MAX_VARIANTS_PER_SAVE} variações por salvamento.`
    );
  }
  return raw as VariantInput[];
}

async function resolveVariantOptions(
  companyId: number,
  characteristics: Array<{ name: string; options: string[] }>,
  attributeMap: Map<string, InventoryProductAttribute>,
  optionMap: Map<string, InventoryProductAttributeOption>,
  refs: unknown,
  transaction: Transaction
): Promise<
  Array<{
    attributeId: number;
    optionId: number;
    attributeName: string;
    optionValue: string;
  }>
> {
  if (!Array.isArray(refs) || refs.length === 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Cada variação precisa das opções da combinação."
    );
  }
  const resolved: Array<{
    attributeId: number;
    optionId: number;
    attributeName: string;
    optionValue: string;
  }> = [];
  const seenAttrs = new Set<number>();

  for (const ref of refs as VariantOptionRef[]) {
    const characteristicName = normalizeOptionalString(
      ref?.characteristicName,
      80
    );
    const optionValue = normalizeOptionalString(ref?.optionValue, 120);
    if (!characteristicName || !optionValue) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Combinação de variação inválida."
      );
    }
    const charDef = characteristics.find(
      c => c.name.toLowerCase() === characteristicName.toLowerCase()
    );
    if (!charDef) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `Característica não encontrada: ${characteristicName}.`
      );
    }
    if (
      !charDef.options.some(
        o => o.toLowerCase() === optionValue.toLowerCase()
      )
    ) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `Opção ${optionValue} não pertence a ${characteristicName}.`
      );
    }
    const attrKey = characteristicName.toLowerCase();
    let attribute = attributeMap.get(attrKey);
    if (!attribute) {
      attribute = await findOrCreateAttribute(
        companyId,
        charDef.name,
        attributeMap.size,
        transaction
      );
      attributeMap.set(attrKey, attribute);
    }
    if (seenAttrs.has(attribute.id)) continue;
    seenAttrs.add(attribute.id);

    const optKey = `${attribute.id}::${optionValue.toLowerCase()}`;
    let option = optionMap.get(optKey);
    if (!option) {
      const canonical = charDef.options.find(
        o => o.toLowerCase() === optionValue.toLowerCase()
      ) as string;
      option = await findOrCreateOption(
        companyId,
        attribute.id,
        canonical,
        optionMap.size,
        transaction
      );
      optionMap.set(optKey, option);
    }
    resolved.push({
      attributeId: attribute.id,
      optionId: option.id,
      attributeName: attribute.name,
      optionValue: option.value
    });
  }

  if (!resolved.length) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Cada variação precisa das opções da combinação."
    );
  }
  return resolved;
}

async function variantHasHistory(
  companyId: number,
  variantId: number,
  transaction: Transaction
): Promise<boolean> {
  const [saleCount, moveCount] = await Promise.all([
    InventorySaleItem.count({
      where: { companyId, variantId },
      transaction
    }),
    InventoryStockMovement.count({
      where: { companyId, variantId },
      transaction
    })
  ]);
  return saleCount > 0 || moveCount > 0;
}

async function persistProductShell(
  companyId: number,
  body: ProductBody,
  productId: number | null,
  transaction: Transaction
): Promise<InventoryProduct> {
  const name = normalizeOptionalString(body.name, 200);
  if (!name) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Nome do produto é obrigatório."
    );
  }

  const unit =
    body.unit === undefined || body.unit === null
      ? "un"
      : productId == null
        ? assertNewInventoryProductUnit(body.unit)
        : normalizeOptionalString(body.unit, 16) || "un";

  let categoryId: number | null = null;
  if (
    body.categoryId !== undefined &&
    body.categoryId !== null &&
    body.categoryId !== ""
  ) {
    categoryId = Number(body.categoryId);
    if (!Number.isFinite(categoryId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "categoryId inválido.");
    }
    await assertInventoryCategoryBelongsToCompany(companyId, categoryId);
  }

  const active =
    body.active === undefined
      ? true
      : body.active === true ||
        body.active === "true" ||
        body.active === 1 ||
        body.active === "1";

  const imageUrl = normalizeOptionalString(body.imageUrl, 500);
  const description = normalizeOptionalString(body.description);

  if (productId == null) {
    return InventoryProduct.create(
      {
        companyId,
        categoryId,
        productKind: INVENTORY_PRODUCT_KIND_VARIABLE,
        sku: null,
        barcode: null,
        name,
        description,
        unit,
        salePrice: 0,
        costPrice: null,
        trackStock: false,
        currentQuantity: 0,
        minStock: null,
        imageUrl,
        active
      },
      { transaction }
    );
  }

  const product = await findInventoryProductOrThrow(
    companyId,
    productId,
    transaction
  );
  if (!isVariableProduct(product)) {
    throw new AppError(
      "ERR_INVENTORY_PRODUCT_NOT_VARIABLE",
      400,
      "Somente produtos com variações usam este salvamento."
    );
  }
  await product.update(
    {
      categoryId,
      name,
      description,
      unit,
      imageUrl,
      active,
      productKind: INVENTORY_PRODUCT_KIND_VARIABLE,
      sku: null,
      barcode: null,
      salePrice: 0,
      costPrice: null,
      trackStock: false
    },
    { transaction }
  );
  return product;
}

export default async function SaveInventoryVariableProductService(input: {
  companyId: number;
  productId?: number | null;
  body: ProductBody;
  createdBy?: number | null;
}): Promise<{ product: any; variants: InventoryProductVariant[] }> {
  const characteristics = parseCharacteristics(input.body.characteristics);
  const variantRows = parseVariantRows(input.body.variants);
  const isCreate = input.productId == null;

  const productId = await sequelize.transaction(async (t: Transaction) => {
    const product = await persistProductShell(
      input.companyId,
      input.body,
      input.productId ?? null,
      t
    );

    const attributeMap = new Map<string, InventoryProductAttribute>();
    const optionMap = new Map<string, InventoryProductAttributeOption>();

    // Pré-cria características/opções declaradas (find-or-create compartilhado).
    for (let i = 0; i < characteristics.length; i += 1) {
      const char = characteristics[i];
      const attr = await findOrCreateAttribute(
        input.companyId,
        char.name,
        i,
        t
      );
      attributeMap.set(char.name.toLowerCase(), attr);
      for (let j = 0; j < char.options.length; j += 1) {
        const opt = await findOrCreateOption(
          input.companyId,
          attr.id,
          char.options[j],
          j,
          t
        );
        optionMap.set(`${attr.id}::${opt.value.toLowerCase()}`, opt);
      }
    }

    const seenCombinationKeys = new Set<string>();
    const keptVariantIds = new Set<number>();

    for (const row of variantRows) {
      const resolved = await resolveVariantOptions(
        input.companyId,
        characteristics,
        attributeMap,
        optionMap,
        row.options,
        t
      );
      const combinationKey = buildCombinationKey(resolved);
      if (seenCombinationKeys.has(combinationKey)) {
        throw new AppError(
          "ERR_INVENTORY_VARIANT_COMBINATION_DUPLICATE",
          400,
          "Há variações duplicadas na lista."
        );
      }
      seenCombinationKeys.add(combinationKey);

      const label =
        normalizeOptionalString(row.label, 200) || buildVariantLabel(resolved);
      const salePrice = parseRequiredDecimal(row.salePrice, "salePrice");
      if (salePrice < 0) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          `Informe o preço de venda da variação ${label}.`
        );
      }
      const costPrice = parseDecimal(row.costPrice, "costPrice");
      if (costPrice !== null && costPrice < 0) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "costPrice inválido.");
      }
      const minStock = parseDecimal(row.minStock, "minStock");
      if (minStock !== null && minStock < 0) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "minStock inválido.");
      }
      const trackStock =
        row.trackStock === undefined
          ? true
          : row.trackStock === true ||
            row.trackStock === "true" ||
            row.trackStock === 1 ||
            row.trackStock === "1";
      const active =
        row.active === undefined
          ? true
          : row.active === true ||
            row.active === "true" ||
            row.active === 1 ||
            row.active === "1";
      const sku = normalizeOptionalString(row.sku, 64);
      const barcode = normalizeOptionalString(row.barcode, 64);

      let existingId: number | null = null;
      if (row.id !== undefined && row.id !== null && row.id !== "") {
        existingId = Number(row.id);
        if (!Number.isFinite(existingId)) {
          throw new AppError("ERR_VALIDATION_ERROR", 400, "id de variação inválido.");
        }
      }

      if (existingId != null) {
        const variant = await InventoryProductVariant.findOne({
          where: {
            id: existingId,
            companyId: input.companyId,
            productId: product.id
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!variant) {
          throw new AppError("ERR_INVENTORY_VARIANT_NOT_FOUND", 404);
        }
        if (variant.combinationKey !== combinationKey) {
          const hasHistory = await variantHasHistory(
            input.companyId,
            variant.id,
            t
          );
          if (hasHistory) {
            throw new AppError(
              "ERR_INVENTORY_VARIANT_COMBINATION_LOCKED",
              400,
              `Não é possível alterar a combinação da variação ${variant.label} porque ela já possui histórico. Desative-a e crie uma nova.`
            );
          }
          const dup = await InventoryProductVariant.findOne({
            where: {
              companyId: input.companyId,
              productId: product.id,
              combinationKey
            },
            transaction: t
          });
          if (dup && dup.id !== variant.id) {
            throw new AppError(
              "ERR_INVENTORY_VARIANT_COMBINATION_DUPLICATE",
              400,
              "Já existe uma variação com esta combinação."
            );
          }
          await InventoryProductVariantOption.destroy({
            where: { companyId: input.companyId, variantId: variant.id },
            transaction: t
          });
          for (const opt of resolved) {
            await InventoryProductVariantOption.create(
              {
                companyId: input.companyId,
                variantId: variant.id,
                attributeId: opt.attributeId,
                optionId: opt.optionId
              },
              { transaction: t }
            );
          }
          await variant.update(
            {
              label,
              combinationKey,
              salePrice,
              costPrice,
              minStock,
              trackStock,
              active,
              sku,
              barcode
            },
            { transaction: t }
          );
        } else {
          await variant.update(
            {
              label,
              salePrice,
              costPrice,
              minStock,
              trackStock,
              active,
              sku,
              barcode
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
        keptVariantIds.add(variant.id);
        continue;
      }

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
          `Já existe uma variação ${dup.label}.`
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

      for (const opt of resolved) {
        await InventoryProductVariantOption.create(
          {
            companyId: input.companyId,
            variantId: variant.id,
            attributeId: opt.attributeId,
            optionId: opt.optionId
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

      let initialQty = 0;
      if (
        row.currentQuantity !== undefined &&
        row.currentQuantity !== null &&
        row.currentQuantity !== ""
      ) {
        initialQty = parseRequiredDecimal(
          row.currentQuantity,
          "currentQuantity"
        );
        if (initialQty < 0) {
          throw new AppError(
            "ERR_VALIDATION_ERROR",
            400,
            "Quantidade inicial inválida."
          );
        }
      }
      if (trackStock && initialQty > 0) {
        await CreateInventoryStockMovementService({
          companyId: input.companyId,
          createdBy: input.createdBy ?? null,
          transaction: t,
          body: {
            productId: product.id,
            variantId: variant.id,
            type: "initial",
            quantity: initialQty,
            notes: "Saldo inicial da variante"
          }
        });
      }

      keptVariantIds.add(variant.id);
    }

    if (!isCreate) {
      const existing = await InventoryProductVariant.findAll({
        where: { companyId: input.companyId, productId: product.id },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      for (const variant of existing) {
        if (keptVariantIds.has(variant.id)) continue;
        const hasHistory = await variantHasHistory(
          input.companyId,
          variant.id,
          t
        );
        if (hasHistory) {
          if (variant.active) {
            await variant.update({ active: false }, { transaction: t });
          }
        } else {
          await InventoryProductVariantOption.destroy({
            where: { companyId: input.companyId, variantId: variant.id },
            transaction: t
          });
          await clearSellableCodesForVariant(
            input.companyId,
            variant.id,
            t
          );
          await variant.destroy({ transaction: t });
        }
      }
    }

    return product.id;
  });

  const product = await ShowInventoryProductService({
    companyId: input.companyId,
    id: productId
  });
  const variants = await ListInventoryProductVariantsService({
    companyId: input.companyId,
    productId
  });
  return { product, variants };
}
