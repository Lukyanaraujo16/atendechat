import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryProduct from "../../models/InventoryProduct";
import InventorySaleItemIdentifier from "../../models/InventorySaleItemIdentifier";
import {
  assertInventorySaleIsDraft,
  computeLineTotal,
  findInventorySaleOrThrow,
  recalculateInventorySaleTotals,
  roundMoney,
  toMoney
} from "./inventorySaleHelpers";
import {
  assertQuantityReductionAllowsIdentifiers,
  buildInventorySaleItemIdentifierInclude,
  parseAndNormalizeIdentifiers,
  parseIdentifiersField,
  replaceSaleItemIdentifiers
} from "./inventorySaleItemIdentifiers";
import { parseDecimal, parseRequiredDecimal } from "./inventoryTenant";

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

export default async function UpdateInventorySaleItemService(input: {
  companyId: number;
  saleId: number;
  itemId: number;
  body: {
    quantity?: unknown;
    unitPrice?: unknown;
    discountAmount?: unknown;
    identifiers?: unknown;
  };
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
    let discountAmount = toMoney(item.discountAmount);

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

    if (input.body.discountAmount !== undefined) {
      discountAmount =
        parseDecimal(input.body.discountAmount, "discountAmount") ?? 0;
      if (discountAmount < 0) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "discountAmount inválido."
        );
      }
      patch.discountAmount = roundMoney(discountAmount);
    }

    const identifiersField = parseIdentifiersField(input.body.identifiers);

    if (Object.keys(patch).length === 0 && identifiersField === "omitted") {
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

    if (identifiersField === "omitted") {
      const existing = await InventorySaleItemIdentifier.findAll({
        where: { saleItemId: item.id, companyId: input.companyId },
        transaction: t
      });
      assertQuantityReductionAllowsIdentifiers(existing, quantity);
    }

    const identifiers =
      identifiersField === "omitted"
        ? null
        : parseAndNormalizeIdentifiers(identifiersField, quantity);

    if (Object.keys(patch).length > 0) {
      patch.totalAmount = computeLineTotal(unitPrice, quantity, discountAmount);
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
