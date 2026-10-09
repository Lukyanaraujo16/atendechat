import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import InventorySaleItemIdentifier from "../../models/InventorySaleItemIdentifier";
import {
  assertInventorySaleIsDraft,
  buildProductSnapshot,
  buildVariantSaleSnapshot,
  findInventorySaleOrThrow,
  loadActiveInventoryProductOrThrow,
  recalculateInventorySaleTotals,
  roundMoney,
  toMoney
} from "./inventorySaleHelpers";
import { computeItemDiscountAmount } from "./inventoryDiscountHelpers";
import {
  assertCanApplyDiscount,
  assertMerchandiseDiscountGovernance,
  buildMerchandiseDiscountSnapshot,
  DiscountAuthorizationInput,
  loadMaxDiscountPercent
} from "./inventoryDiscountGovernance";
import { syncDraftPendingAfterTotalChange } from "./inventorySalePaymentEngine";
import {
  assertQuantityReductionAllowsIdentifiers,
  buildInventorySaleItemIdentifierInclude,
  parseAndNormalizeIdentifiers,
  parseIdentifiersField,
  replaceSaleItemIdentifiers
} from "./inventorySaleItemIdentifiers";
import { parseRequiredDecimal } from "./inventoryTenant";
import { isVariableProduct } from "./inventoryProductKind";

async function findSaleItemOrThrow(
  companyId: number,
  saleId: number,
  itemId: number,
  transaction?: Transaction
): Promise<InventorySaleItem> {
  const item = await InventorySaleItem.findOne({
    where: { id: itemId, saleId, companyId },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {})
  });
  if (!item) {
    throw new AppError("ERR_INVENTORY_SALE_ITEM_NOT_FOUND", 404);
  }
  return item;
}

async function resolveSellableSnapshot(
  companyId: number,
  productId: number,
  variantId: number | null,
  transaction: Transaction
) {
  const product = await loadActiveInventoryProductOrThrow(
    companyId,
    productId,
    transaction
  );

  if (isVariableProduct(product)) {
    if (variantId == null) {
      throw new AppError(
        "ERR_INVENTORY_VARIANT_REQUIRED",
        400,
        "Produto com variações exige seleção de variante."
      );
    }
    const variant = await InventoryProductVariant.findOne({
      where: {
        id: variantId,
        companyId,
        productId: product.id
      },
      transaction
    });
    if (!variant || !variant.active) {
      throw new AppError(
        "ERR_INVENTORY_VARIANT_INACTIVE",
        400,
        "Variante inválida ou inativa."
      );
    }
    return buildVariantSaleSnapshot(product, variant);
  }

  if (variantId != null) {
    throw new AppError(
      "ERR_INVENTORY_VARIANT_NOT_ALLOWED",
      400,
      "Produto simples não aceita variantId."
    );
  }

  return buildProductSnapshot(product);
}

export default async function UpdateInventorySaleItemService(input: {
  companyId: number;
  saleId: number;
  itemId: number;
  body: {
    productId?: unknown;
    variantId?: unknown;
    quantity?: unknown;
    unitPrice?: unknown;
    discountAmount?: unknown;
    discountType?: unknown;
    discountPercent?: unknown;
    discountAuthorization?: DiscountAuthorizationInput;
    identifiers?: unknown;
  };
  canApplyDiscount?: boolean;
}): Promise<InventorySaleItem> {
  return sequelize.transaction(async t => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t,
      t.LOCK.UPDATE
    );
    assertInventorySaleIsDraft(sale, "ter itens editados");

    const item = await findSaleItemOrThrow(
      input.companyId,
      input.saleId,
      input.itemId,
      t
    );
    const patch: Partial<InventorySaleItem> = {};

    let quantity = Number(item.quantity);
    let unitPrice = toMoney(item.unitPrice);
    let discountType: unknown = item.discountType;
    let discountAmount: unknown = item.discountAmount;
    let discountPercent: unknown = item.discountPercent;
    let discountFieldsTouched = false;
    let sellableChanged = false;

    const productIdTouched = input.body.productId !== undefined;
    const variantIdTouched = input.body.variantId !== undefined;

    if (productIdTouched || variantIdTouched) {
      let nextProductId = item.productId;
      if (productIdTouched) {
        nextProductId = Number(input.body.productId);
        if (!Number.isFinite(nextProductId)) {
          throw new AppError(
            "ERR_VALIDATION_ERROR",
            400,
            "productId inválido."
          );
        }
      }

      let nextVariantId: number | null =
        item.variantId != null ? Number(item.variantId) : null;
      if (variantIdTouched) {
        if (
          input.body.variantId === null ||
          input.body.variantId === ""
        ) {
          nextVariantId = null;
        } else {
          nextVariantId = Number(input.body.variantId);
          if (!Number.isFinite(nextVariantId)) {
            throw new AppError(
              "ERR_VALIDATION_ERROR",
              400,
              "variantId inválido."
            );
          }
        }
      }

      const prevVariantId =
        item.variantId != null ? Number(item.variantId) : null;
      sellableChanged =
        nextProductId !== item.productId || nextVariantId !== prevVariantId;

      if (sellableChanged) {
        const snapshot = await resolveSellableSnapshot(
          input.companyId,
          nextProductId,
          nextVariantId,
          t
        );
        patch.productId = snapshot.productId;
        patch.variantId = snapshot.variantId;
        patch.productName = snapshot.productName;
        patch.productSku = snapshot.productSku;
        patch.variantLabel = snapshot.variantLabel;
        patch.variantSku = snapshot.variantSku;
        patch.variantBarcode = snapshot.variantBarcode;
        patch.unit = snapshot.unit;
        patch.costPrice = snapshot.costPrice;
        patch.trackStock = snapshot.trackStock;
        // Preço da nova unidade vendável, salvo override explícito no mesmo request.
        if (input.body.unitPrice === undefined) {
          unitPrice = snapshot.unitPrice;
          patch.unitPrice = roundMoney(unitPrice);
        }
      }
    }

    if (input.body.quantity !== undefined) {
      quantity = parseRequiredDecimal(input.body.quantity, "quantity");
      if (quantity <= 0) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "quantity deve ser maior que zero."
        );
      }
      patch.quantity = quantity;
    }

    if (input.body.unitPrice !== undefined) {
      unitPrice = parseRequiredDecimal(input.body.unitPrice, "unitPrice");
      if (unitPrice < 0) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "unitPrice inválido.");
      }
      patch.unitPrice = roundMoney(unitPrice);
    }

    if (input.body.discountType !== undefined) {
      discountType = input.body.discountType;
      discountFieldsTouched = true;
    }
    if (input.body.discountAmount !== undefined) {
      discountAmount = input.body.discountAmount;
      discountFieldsTouched = true;
    }
    if (input.body.discountPercent !== undefined) {
      discountPercent = input.body.discountPercent;
      discountFieldsTouched = true;
    }

    const identifiersField = parseIdentifiersField(input.body.identifiers);

    if (
      Object.keys(patch).length === 0 &&
      !discountFieldsTouched &&
      identifiersField === "omitted"
    ) {
      return item.reload({
        transaction: t,
        include: [
          {
            model: InventoryProduct,
            attributes: ["id", "name", "sku", "active"],
            required: false
          },
          buildInventorySaleItemIdentifierInclude(input.companyId)
        ]
      });
    }

    const existingIdentifiers = await InventorySaleItemIdentifier.findAll({
      where: { saleItemId: item.id, companyId: input.companyId },
      transaction: t
    });

    if (sellableChanged && existingIdentifiers.length > 0) {
      if (identifiersField === "omitted") {
        throw new AppError(
          "ERR_INVENTORY_IDENTIFIERS_NEED_REVIEW",
          400,
          "Troca de produto/variante exige revisar ou limpar as identificações das unidades."
        );
      }
    }

    if (identifiersField === "omitted") {
      assertQuantityReductionAllowsIdentifiers(existingIdentifiers, quantity);
    }

    const identifiers =
      identifiersField === "omitted"
        ? null
        : parseAndNormalizeIdentifiers(identifiersField, quantity);

    const computed = computeItemDiscountAmount({
      discountType,
      discountAmount,
      discountPercent,
      unitPrice,
      quantity
    });

    if (
      discountFieldsTouched ||
      patch.quantity != null ||
      patch.unitPrice != null ||
      sellableChanged
    ) {
      assertCanApplyDiscount({
        canApplyDiscount: input.canApplyDiscount !== false,
        discountAmount: computed.discountAmount
      });

      if (discountFieldsTouched) {
        patch.discountType = computed.discountType;
        patch.discountPercent = computed.discountPercent;
      } else if (item.discountType === "percentage") {
        // Recalcula monetary a partir do % quando qty/preço mudam.
        patch.discountPercent = computed.discountPercent;
      }
      patch.discountAmount = computed.discountAmount;
      patch.totalAmount = computed.lineTotal;
    }

    if (Object.keys(patch).length > 0) {
      await item.update(patch, { transaction: t });
    }

    if (identifiers != null) {
      await replaceSaleItemIdentifiers({
        companyId: input.companyId,
        saleItemId: item.id,
        identifiers,
        transaction: t
      });
    }

    if (Object.keys(patch).length > 0) {
      await recalculateInventorySaleTotals(sale.id, input.companyId, t);
      await sale.reload({ transaction: t });

      const maxAllowedPercent = await loadMaxDiscountPercent(input.companyId, t);
      const items = await InventorySaleItem.findAll({
        where: { saleId: sale.id, companyId: input.companyId },
        transaction: t
      });
      const snapshotDisc = buildMerchandiseDiscountSnapshot({
        items,
        globalDiscountType: sale.globalDiscountType,
        globalDiscountAmount: sale.globalDiscountAmount,
        globalDiscountPercent: sale.globalDiscountPercent,
        maxAllowedPercent
      });
      await assertMerchandiseDiscountGovernance({
        companyId: input.companyId,
        sale,
        snapshot: snapshotDisc,
        authorization: input.body.discountAuthorization,
        transaction: t
      });

      await syncDraftPendingAfterTotalChange(sale, t);
    }

    return item.reload({
      transaction: t,
      include: [
        {
          model: InventoryProduct,
          attributes: ["id", "name", "sku", "active"],
          required: false
        },
        buildInventorySaleItemIdentifierInclude(input.companyId)
      ]
    });
  });
}
