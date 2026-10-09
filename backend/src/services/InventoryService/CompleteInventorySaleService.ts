import { Transaction, Op } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySettings from "../../models/InventorySettings";
import InventorySale from "../../models/InventorySale";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import InventorySellerProfile from "../../models/InventorySellerProfile";
import InventorySaleItemIdentifier from "../../models/InventorySaleItemIdentifier";
import GetOrCreateInventorySettingsService from "./GetOrCreateInventorySettingsService";
import {
  assertInventorySaleIsDraft,
  assertInventoryUserInCompany,
  buildInventorySaleIncludes,
  recalculateInventorySaleTotals,
  roundMoney,
  toMoney
} from "./inventorySaleHelpers";
import { isVariableProduct } from "./inventoryProductKind";
import {
  applySellableQuantity,
  lockSellableStockTarget
} from "./inventorySellableStock";
import { settlePaymentOnComplete } from "./inventoryPaymentHelpers";
import {
  applyCompletePaymentSettlement,
  listSalePayments,
  persistSalePaymentCache
} from "./inventorySalePaymentEngine";
import { validateExplicitPaymentLinesForComplete } from "./InventorySalePaymentLinesService";
import { assertIdentifiersForCompleteSale } from "./inventorySaleItemIdentifiers";
import CreateInventoryReceivableFromSaleService, {
  StoreCreditScheduleInput
} from "./CreateInventoryReceivableFromSaleService";
import { StoreCreditOverrideInput } from "./ValidateInventoryStoreCreditForCompleteService";
import {
  assertMerchandiseDiscountGovernance,
  DiscountAuthorizationInput,
  snapshotSaleMerchandiseDiscount
} from "./inventoryDiscountGovernance";

export default async function CompleteInventorySaleService(input: {
  companyId: number;
  saleId: number;
  sellerUserId?: unknown;
  completedBy: number | null;
  /** Só honrado quando canManagePayments === true (resolvido no controller). */
  registerAsPaid?: boolean;
  canManagePayments?: boolean;
  /** Wizard P3: payments já explícitos — não reaplicar settle legado. */
  paymentMode?: "legacy" | "lines";
  /** Condição do Crédito da Loja quando há linhas store_credit. */
  storeCreditSchedule?: StoreCreditScheduleInput;
  storeCreditOverride?: StoreCreditOverrideInput;
  canUseStoreCredit?: boolean;
  discountAuthorization?: DiscountAuthorizationInput;
}): Promise<InventorySale> {
  await GetOrCreateInventorySettingsService(input.companyId);

  const completedSaleId = await sequelize.transaction(async (t: Transaction) => {
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

    const identifiers = await InventorySaleItemIdentifier.findAll({
      where: {
        companyId: input.companyId,
        saleItemId: items.map(item => item.id)
      },
      transaction: t
    });

    const strayIdentifiers = await InventorySaleItemIdentifier.count({
      where: {
        saleItemId: items.map(item => item.id),
        companyId: { [Op.ne]: input.companyId }
      },
      transaction: t
    });
    if (strayIdentifiers > 0) {
      throw new AppError(
        "ERR_INVENTORY_SALE_IDENTIFIER_COMPANY_MISMATCH",
        403,
        "Identificador não pertence à empresa da venda."
      );
    }

    assertIdentifiersForCompleteSale({
      companyId: input.companyId,
      items: items.map(item => ({
        id: item.id,
        companyId: item.companyId,
        quantity: item.quantity
      })),
      identifiers: identifiers.map(row => ({
        companyId: row.companyId,
        saleItemId: row.saleItemId,
        position: row.position,
        identifier: row.identifier
      }))
    });

    let { sellerUserId } = sale;
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

    // Ordena locks por (productId, variantId) para reduzir deadlocks.
    const stockItems = [...items]
      .filter(item => item.trackStock)
      .sort((a, b) => {
        if (a.productId !== b.productId) return a.productId - b.productId;
        return Number(a.variantId || 0) - Number(b.variantId || 0);
      });

    for (const item of stockItems) {
      const target = await lockSellableStockTarget({
        companyId: input.companyId,
        productId: item.productId,
        variantId: item.variantId,
        transaction: t,
        requireActive: true
      });

      if (isVariableProduct(target.product) && item.variantId == null) {
        throw new AppError(
          "ERR_INVENTORY_VARIANT_REQUIRED",
          400,
          `O produto ${target.product.name} exige variante.`
        );
      }

      const label =
        target.kind === "variant"
          ? `${target.product.name} — ${target.variant.label}`
          : target.product.name;

      const deductQty = Number(item.quantity);
      const currentQty = target.currentQuantity;
      const newBalance = currentQty - deductQty;

      if (newBalance < 0 && !settings.allowNegativeStock) {
        throw new AppError(
          "ERR_INVENTORY_INSUFFICIENT_STOCK",
          400,
          `Estoque insuficiente para ${label}.`
        );
      }

      await InventoryStockMovement.create(
        {
          companyId: input.companyId,
          productId: target.product.id,
          variantId: target.kind === "variant" ? target.variant.id : null,
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

      await applySellableQuantity(target, newBalance, t);
    }

    await recalculateInventorySaleTotals(sale.id, input.companyId, t);
    await sale.reload({ transaction: t });

    const discountSnapshot = await snapshotSaleMerchandiseDiscount(sale, t);
    await assertMerchandiseDiscountGovernance({
      companyId: input.companyId,
      sale,
      snapshot: discountSnapshot,
      authorization: input.discountAuthorization,
      actorUserId: input.completedBy,
      transaction: t
    });

    const sellerProfile = await InventorySellerProfile.findOne({
      where: { companyId: input.companyId, userId: sellerUserId, active: true },
      transaction: t
    });

    let commissionRate = toMoney(settings.defaultCommissionRate);
    if (sellerProfile) {
      commissionRate = toMoney(sellerProfile.commissionRate);
    }

    const totalAmount = toMoney(sale.totalAmount);
    // Comissão sobre mercadoria líquida após TODOS os descontos, SEM frete.
    const commissionBase = roundMoney(
      Math.max(0, totalAmount - toMoney(sale.freightAmount))
    );
    const commissionAmount = roundMoney(
      (commissionBase * commissionRate) / 100
    );
    const useExplicitLines = input.paymentMode === "lines";
    let paymentCache;
    let lines = await listSalePayments(sale.companyId, sale.id, t);

    if (useExplicitLines) {
      await validateExplicitPaymentLinesForComplete(sale, t, {
        requireFullAllocation: input.canManagePayments === true
      });
      lines = await listSalePayments(sale.companyId, sale.id, t);
      paymentCache = await persistSalePaymentCache(sale, lines, t);
    } else {
      if (sale.paymentMethod === "store_credit") {
        throw new AppError(
          "ERR_INVENTORY_STORE_CREDIT_LINES_REQUIRED",
          400,
          "Crédito da Loja exige pagamento explícito por linhas (paymentMode=lines)."
        );
      }
      const settled = settlePaymentOnComplete({
        paymentMethod: sale.paymentMethod,
        cardInstallmentCount: sale.cardInstallmentCount,
        totalAmount,
        paidAmount: toMoney(sale.paidAmount),
        existingPaidAt: sale.paidAt,
        registerAsPaid: input.registerAsPaid,
        canManagePayments: input.canManagePayments === true
      });

      paymentCache = await applyCompletePaymentSettlement(
        sale,
        {
          targetPaidAmount: settled.paidAmount,
          paymentStatus: settled.paymentStatus,
          paidAt: settled.paidAt,
          actorUserId: input.completedBy
        },
        t
      );
      lines = await listSalePayments(sale.companyId, sale.id, t);
    }

    const storeCreditLines = lines.filter(
      l => l.method === "store_credit" && l.status === "pending"
    );
    const financedAmount = roundMoney(
      storeCreditLines.reduce((acc, l) => acc + toMoney(l.amount), 0)
    );

    if (financedAmount > 0) {
      if (input.canUseStoreCredit !== true) {
        throw new AppError(
          "ERR_NO_PERMISSION",
          403,
          "Sem permissão para usar Crédito da Loja."
        );
      }
      if (!input.storeCreditSchedule) {
        throw new AppError(
          "ERR_INVENTORY_STORE_CREDIT_SCHEDULE_REQUIRED",
          400,
          "Informe a condição de pagamento do Crédito da Loja."
        );
      }
      await CreateInventoryReceivableFromSaleService({
        companyId: input.companyId,
        sale,
        financedAmount,
        schedule: input.storeCreditSchedule,
        createdByUserId: input.completedBy,
        override: input.storeCreditOverride,
        transaction: t
      });
    }

    await settings.update(
      { nextSaleNumber: saleNumber + 1 },
      { transaction: t }
    );

    await sale.update(
      {
        status: "completed",
        saleNumber,
        sellerUserId,
        commissionRate,
        commissionAmount,
        completedAt: new Date(),
        paymentStatus: paymentCache.paymentStatus,
        paidAmount: paymentCache.paidAmount,
        paidAt: paymentCache.paidAt,
        paymentMethod: paymentCache.paymentMethod,
        cardInstallmentCount: paymentCache.cardInstallmentCount,
        paymentNotes: paymentCache.paymentNotes
      },
      { transaction: t }
    );

    // Não faz reload com includes aninhados (items + identifiers separate)
    // dentro da transaction com LOCK — o payload pode sair incompleto.
    // O GET pós-commit espelha ShowInventorySaleService / drawer.
    return sale.id;
  });

  const completed = await InventorySale.findOne({
    where: { id: completedSaleId, companyId: input.companyId }
  });
  if (!completed) {
    throw new AppError("ERR_INVENTORY_SALE_NOT_FOUND", 404);
  }
  return completed.reload({
    include: buildInventorySaleIncludes(input.companyId)
  });
}
