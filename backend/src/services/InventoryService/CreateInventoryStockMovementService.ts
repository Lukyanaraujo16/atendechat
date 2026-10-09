import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import User from "../../models/User";
import GetOrCreateInventorySettingsService from "./GetOrCreateInventorySettingsService";
import {
  isInventoryStockMovementType,
  InventoryStockMovementType
} from "./inventoryStockMovementTypes";
import {
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal
} from "./inventoryTenant";
import {
  applySellableQuantity,
  lockSellableStockTarget
} from "./inventorySellableStock";

type CreateBody = {
  productId?: unknown;
  variantId?: unknown;
  type?: unknown;
  quantity?: unknown;
  unitCost?: unknown;
  notes?: unknown;
  referenceType?: unknown;
  referenceId?: unknown;
};

export default async function CreateInventoryStockMovementService(input: {
  companyId: number;
  createdBy: number | null;
  body: CreateBody;
}): Promise<InventoryStockMovement> {
  const productId = Number(input.body.productId);
  if (!Number.isFinite(productId)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "productId inválido.");
  }

  let variantId: number | null = null;
  if (
    input.body.variantId !== undefined &&
    input.body.variantId !== null &&
    input.body.variantId !== ""
  ) {
    variantId = Number(input.body.variantId);
    if (!Number.isFinite(variantId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "variantId inválido.");
    }
  }

  const typeRaw = String(input.body.type ?? "").trim();
  if (!isInventoryStockMovementType(typeRaw)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Tipo de movimentação inválido.");
  }
  const type = typeRaw as InventoryStockMovementType;

  const notes = normalizeOptionalString(input.body.notes);
  if ((type === "out" || type === "adjustment") && !notes) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Observação obrigatória para saída e ajuste."
    );
  }

  const unitCost = parseDecimal(input.body.unitCost, "unitCost");
  if (unitCost !== null && unitCost < 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "unitCost inválido.");
  }

  let referenceId: number | null = null;
  if (
    input.body.referenceId !== undefined &&
    input.body.referenceId !== null &&
    input.body.referenceId !== ""
  ) {
    referenceId = Number(input.body.referenceId);
    if (!Number.isFinite(referenceId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "referenceId inválido.");
    }
  }

  const referenceType = normalizeOptionalString(input.body.referenceType, 32);

  return sequelize.transaction(async (t: Transaction) => {
    const settings = await GetOrCreateInventorySettingsService(input.companyId);

    const target = await lockSellableStockTarget({
      companyId: input.companyId,
      productId,
      variantId,
      transaction: t,
      requireActive: true
    });

    if (!target.trackStock) {
      throw new AppError(
        "ERR_INVENTORY_PRODUCT_NO_STOCK_TRACKING",
        400,
        "Unidade vendável não controla estoque."
      );
    }

    const currentQty = target.currentQuantity;
    let movementQty: number;
    let newBalance: number;

    if (type === "adjustment") {
      const targetBalance = parseDecimal(input.body.quantity, "quantity");
      if (targetBalance === null || targetBalance < 0) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "Ajuste requer saldo final válido (>= 0)."
        );
      }
      newBalance = targetBalance;
      movementQty = newBalance - currentQty;
      if (movementQty === 0) {
        throw new AppError(
          "ERR_INVENTORY_STOCK_NO_CHANGE",
          400,
          "O saldo informado é igual ao saldo atual."
        );
      }
    } else {
      const qty = parseRequiredDecimal(input.body.quantity, "quantity");
      if (qty <= 0) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "quantity deve ser maior que zero."
        );
      }

      if (type === "in") {
        movementQty = qty;
        newBalance = currentQty + qty;
      } else if (type === "out") {
        movementQty = -qty;
        newBalance = currentQty - qty;
      } else {
        if (currentQty !== 0) {
          throw new AppError(
            "ERR_INVENTORY_INITIAL_NOT_ZERO",
            400,
            "Saldo inicial só é permitido com estoque zerado."
          );
        }
        const existingWhere: Record<string, unknown> = {
          companyId: input.companyId,
          productId
        };
        if (target.kind === "variant") {
          existingWhere.variantId = target.variant.id;
        } else {
          existingWhere.variantId = null;
        }
        const existing = await InventoryStockMovement.count({
          where: existingWhere,
          transaction: t
        });
        if (existing > 0) {
          throw new AppError(
            "ERR_INVENTORY_INITIAL_ALREADY_EXISTS",
            400,
            "Unidade já possui movimentações de estoque."
          );
        }
        movementQty = qty;
        newBalance = qty;
      }
    }

    if (newBalance < 0 && !settings.allowNegativeStock) {
      throw new AppError(
        "ERR_INVENTORY_INSUFFICIENT_STOCK",
        400,
        "Estoque insuficiente."
      );
    }

    const movement = await InventoryStockMovement.create(
      {
        companyId: input.companyId,
        productId,
        variantId: target.kind === "variant" ? target.variant.id : null,
        type,
        quantity: movementQty,
        balanceAfter: newBalance,
        unitCost,
        referenceType,
        referenceId,
        notes,
        createdBy: input.createdBy
      },
      { transaction: t }
    );

    await applySellableQuantity(target, newBalance, t);

    return movement.reload({
      transaction: t,
      include: [
        {
          model: InventoryProduct,
          attributes: ["id", "name", "sku", "unit", "productKind"],
          required: true
        },
        {
          model: InventoryProductVariant,
          attributes: ["id", "label", "sku", "barcode"],
          required: false
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "name"],
          required: false
        }
      ]
    });
  });
}
