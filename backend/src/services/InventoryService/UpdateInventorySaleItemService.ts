import AppError from "../../errors/AppError";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryProduct from "../../models/InventoryProduct";
import {
  assertInventorySaleIsDraft,
  computeLineTotal,
  findInventorySaleOrThrow,
  recalculateInventorySaleTotals,
  roundMoney,
  toMoney
} from "./inventorySaleHelpers";
import { parseDecimal, parseRequiredDecimal } from "./inventoryTenant";

async function findSaleItemOrThrow(
  companyId: number,
  saleId: number,
  itemId: number
): Promise<InventorySaleItem> {
  const item = await InventorySaleItem.findOne({
    where: { id: itemId, saleId, companyId }
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
  };
}): Promise<InventorySaleItem> {
  const sale = await findInventorySaleOrThrow(input.companyId, input.saleId);
  assertInventorySaleIsDraft(sale, "ter itens editados");

  const item = await findSaleItemOrThrow(input.companyId, input.saleId, input.itemId);
  const patch: Partial<InventorySaleItem> = {};

  let quantity = Number(item.quantity);
  let unitPrice = toMoney(item.unitPrice);
  let discountAmount = toMoney(item.discountAmount);

  if (input.body.quantity !== undefined) {
    quantity = parseRequiredDecimal(input.body.quantity, "quantity");
    if (quantity <= 0) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "quantity deve ser maior que zero.");
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
    discountAmount = parseDecimal(input.body.discountAmount, "discountAmount") ?? 0;
    if (discountAmount < 0) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "discountAmount inválido.");
    }
    patch.discountAmount = roundMoney(discountAmount);
  }

  if (Object.keys(patch).length === 0) {
    return item;
  }

  patch.totalAmount = computeLineTotal(unitPrice, quantity, discountAmount);
  await item.update(patch);
  await recalculateInventorySaleTotals(sale.id, input.companyId);

  return item.reload({
    include: [
      {
        model: InventoryProduct,
        attributes: ["id", "name", "sku", "active"],
        required: false
      }
    ]
  });
}
