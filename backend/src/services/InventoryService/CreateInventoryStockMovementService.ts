import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import InventoryProduct from "../../models/InventoryProduct";
import User from "../../models/User";
import GetOrCreateInventorySettingsService from "./GetOrCreateInventorySettingsService";
import {
  isInventoryStockMovementType,
  InventoryStockMovementType
} from "./inventoryStockMovementTypes";
import {
  findInventoryProductOrThrow,
  normalizeOptionalString,
  parseDecimal,
  parseRequiredDecimal,
  toInventoryQuantity
} from "./inventoryTenant";

type CreateBody = {
  productId?: unknown;
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

    const product = await InventoryProduct.findOne({
      where: { id: productId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!product) {
      throw new AppError("ERR_INVENTORY_PRODUCT_NOT_FOUND", 404);
    }
    if (!product.active) {
      throw new AppError(
        "ERR_INVENTORY_PRODUCT_INACTIVE",
        400,
        "Produto inativo não aceita movimentações."
      );
    }
    if (!product.trackStock) {
      throw new AppError(
        "ERR_INVENTORY_PRODUCT_NO_STOCK_TRACKING",
        400,
        "Produto não controla estoque."
      );
    }

    const currentQty = toInventoryQuantity(product.currentQuantity);
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
        const existing = await InventoryStockMovement.count({
          where: { companyId: input.companyId, productId },
          transaction: t
        });
        if (existing > 0) {
          throw new AppError(
            "ERR_INVENTORY_INITIAL_ALREADY_EXISTS",
            400,
            "Produto já possui movimentações de estoque."
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

    await product.update({ currentQuantity: newBalance }, { transaction: t });

    return movement.reload({
      transaction: t,
      include: [
        {
          model: InventoryProduct,
          attributes: ["id", "name", "sku", "unit"],
          required: true
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
