import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySettings from "../../models/InventorySettings";
import InventorySale from "../../models/InventorySale";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import InventorySellerProfile from "../../models/InventorySellerProfile";
import GetOrCreateInventorySettingsService from "./GetOrCreateInventorySettingsService";
import {
  assertInventorySaleIsDraft,
  assertInventoryUserInCompany,
  inventorySaleIncludes,
  recalculateInventorySaleTotals,
  roundMoney,
  toMoney
} from "./inventorySaleHelpers";
import { toInventoryQuantity } from "./inventoryTenant";
import {
  derivePaymentStatusFromAmount,
  resolvePaidAtForPaymentUpdate
} from "./inventoryPaymentHelpers";

export default async function CompleteInventorySaleService(input: {
  companyId: number;
  saleId: number;
  sellerUserId?: unknown;
  completedBy: number | null;
}): Promise<InventorySale> {
  await GetOrCreateInventorySettingsService(input.companyId);

  return sequelize.transaction(async (t: Transaction) => {
    const sale = await InventorySale.findOne({
      where: { id: input.saleId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!sale) {
      throw new AppError("ERR_INVENTORY_SALE_NOT_FOUND", 404);
    }
    assertInventorySaleIsDraft(sale, "ser concluída");

    if (sale.status === "completed") {
      throw new AppError(
        "ERR_INVENTORY_SALE_ALREADY_COMPLETED",
        400,
        "Venda já está concluída."
      );
    }

    const existingMovements = await InventoryStockMovement.count({
      where: {
        companyId: input.companyId,
        referenceType: "sale",
        referenceId: sale.id,
        type: "sale"
      },
      transaction: t
    });
    if (existingMovements > 0) {
      throw new AppError(
        "ERR_INVENTORY_SALE_ALREADY_COMPLETED",
        400,
        "Baixa de estoque já registrada para esta venda."
      );
    }

    const items = await InventorySaleItem.findAll({
      where: { saleId: sale.id, companyId: input.companyId },
      transaction: t
    });
    if (!items.length) {
      throw new AppError(
        "ERR_INVENTORY_SALE_NO_ITEMS",
        400,
        "A venda precisa ter ao menos um item."
      );
    }

    let sellerUserId = sale.sellerUserId;
    if (input.sellerUserId !== undefined && input.sellerUserId !== null) {
      sellerUserId = Number(input.sellerUserId);
    }
    if (sellerUserId == null || !Number.isFinite(sellerUserId)) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "sellerUserId é obrigatório para concluir a venda."
      );
    }

    await assertInventoryUserInCompany(
      input.companyId,
      sellerUserId,
      "sellerUserId"
    );

    const settings = await InventorySettings.findOne({
      where: { companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!settings) {
      throw new AppError("ERR_INVENTORY_SETTINGS_NOT_FOUND", 404);
    }

    const saleNumber = settings.nextSaleNumber;

    for (const item of items) {
      if (!item.trackStock) continue;

      const product = await InventoryProduct.findOne({
        where: { id: item.productId, companyId: input.companyId },
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
          `O produto ${product.name} está inativo e não pode ser vendido.`
        );
      }

      const deductQty = Number(item.quantity);
      const currentQty = toInventoryQuantity(product.currentQuantity);
      const newBalance = currentQty - deductQty;

      if (newBalance < 0 && !settings.allowNegativeStock) {
        throw new AppError(
          "ERR_INVENTORY_INSUFFICIENT_STOCK",
          400,
          `Estoque insuficiente para o produto ${product.name}.`
        );
      }

      await InventoryStockMovement.create(
        {
          companyId: input.companyId,
          productId: product.id,
          type: "sale",
          quantity: -deductQty,
          balanceAfter: newBalance,
          unitCost: item.costPrice,
          referenceType: "sale",
          referenceId: sale.id,
          notes: `Venda #${saleNumber}`,
          createdBy: input.completedBy
        },
        { transaction: t }
      );

      await product.update({ currentQuantity: newBalance }, { transaction: t });
    }

    await recalculateInventorySaleTotals(sale.id, input.companyId, t);
    await sale.reload({ transaction: t });

    const sellerProfile = await InventorySellerProfile.findOne({
      where: { companyId: input.companyId, userId: sellerUserId, active: true },
      transaction: t
    });

    let commissionRate = toMoney(settings.defaultCommissionRate);
    if (sellerProfile) {
      commissionRate = toMoney(sellerProfile.commissionRate);
    }

    const totalAmount = toMoney(sale.totalAmount);
    const commissionAmount = roundMoney((totalAmount * commissionRate) / 100);
    const paidAmount = toMoney(sale.paidAmount);
    const paymentStatus = derivePaymentStatusFromAmount(paidAmount, totalAmount);
    const paidAt = resolvePaidAtForPaymentUpdate({
      paymentStatus,
      existingPaidAt: sale.paidAt
    });

    await settings.update({ nextSaleNumber: saleNumber + 1 }, { transaction: t });

    await sale.update(
      {
        status: "completed",
        saleNumber,
        sellerUserId,
        commissionRate,
        commissionAmount,
        completedAt: new Date(),
        paymentStatus,
        paidAmount,
        paidAt
      },
      { transaction: t }
    );

    return sale.reload({ transaction: t, include: inventorySaleIncludes });
  });
}
