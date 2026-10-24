import { ForeignKeyConstraintError, Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventorySale from "../../models/InventorySale";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import {
  findInventorySaleOrThrow,
  recalculateInventorySaleTotals,
  toMoney
} from "./inventorySaleHelpers";
import {
  bootstrapLegacyPaymentsIfNeeded,
  buildPaymentFinancialSummary,
  listSalePayments,
  syncDraftPendingAfterTotalChange
} from "./inventorySalePaymentEngine";

export type DeleteInventoryProductResult = {
  removedStockMovements: number;
  removedDraftItems: number;
  removedDraftSales: number;
  removedCancelledSales: number;
  /** Itens de vendas concluídas/canceladas preservados e desvinculados do cadastro. */
  detachedSaleItems: number;
};

/** Sem valor recebido e sem conta a receber: a venda não tem registro financeiro a preservar. */
async function saleHasFinancialRecords(sale: InventorySale, t: Transaction): Promise<boolean> {
  await bootstrapLegacyPaymentsIfNeeded(sale, t, null);
  const payments = await listSalePayments(sale.companyId, sale.id, t);
  const summary = buildPaymentFinancialSummary(sale.totalAmount, payments);
  if (summary.effectivePaid > 0 || toMoney(sale.paidAmount) > 0) return true;
  const receivables = await InventoryReceivable.count({
    where: { companyId: sale.companyId, saleId: sale.id },
    transaction: t
  });
  return receivables > 0;
}

/**
 * Exclusão definitiva do produto, preservando o histórico financeiro.
 *
 * - Venda concluída, ou cancelada com outros produtos/registros financeiros: a venda, os itens,
 *   totais, pagamentos e contas a receber ficam intactos; os itens do produto só são desvinculados
 *   (productId/variantId = NULL) e mantêm o snapshot (nome, códigos, preços, quantidade, totais).
 * - Rascunho: o item sai pela mesma regra de DeleteInventorySaleItemService (totais recalculados,
 *   pagamentos conferidos); rascunho que fica vazio e sem valor recebido também sai.
 * - Venda cancelada só com este produto e sem pagamento/conta a receber: excluída inteira.
 * - Movimentações de estoque, variantes (com opções e códigos) e o produto são excluídos.
 * Tudo numa transação: qualquer falha desfaz a operação inteira.
 */
export default async function DeleteInventoryProductService(input: {
  companyId: number;
  id: number;
}): Promise<DeleteInventoryProductResult> {
  return sequelize.transaction(async transaction => {
    const { companyId } = input;
    const product = await InventoryProduct.findOne({
      where: { id: input.id, companyId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!product) {
      throw new AppError("ERR_INVENTORY_PRODUCT_NOT_FOUND", 404);
    }

    const items = await InventorySaleItem.findAll({
      where: { companyId, productId: product.id },
      attributes: ["id", "saleId"],
      transaction
    });
    const saleIds = Array.from(new Set(items.map(i => i.saleId)));
    const sales = saleIds.length
      ? await InventorySale.findAll({
          where: { companyId, id: { [Op.in]: saleIds } },
          order: [["id", "ASC"]],
          transaction,
          lock: transaction.LOCK.UPDATE
        })
      : [];

    const result: DeleteInventoryProductResult = {
      removedStockMovements: 0,
      removedDraftItems: 0,
      removedDraftSales: 0,
      removedCancelledSales: 0,
      detachedSaleItems: 0
    };

    const preserved: number[] = sales.filter(s => s.status === "completed").map(s => s.id);
    const removableCancelled: InventorySale[] = [];
    for (const sale of sales.filter(s => s.status === "cancelled")) {
      const otherItems = await InventorySaleItem.count({
        where: { companyId, saleId: sale.id, productId: { [Op.ne]: product.id } },
        transaction
      });
      if (otherItems > 0 || (await saleHasFinancialRecords(sale, transaction))) {
        preserved.push(sale.id);
      } else {
        removableCancelled.push(sale);
      }
    }

    if (preserved.length > 0) {
      const [detached] = await InventorySaleItem.update(
        { productId: null, variantId: null },
        { where: { companyId, productId: product.id, saleId: { [Op.in]: preserved } }, transaction }
      );
      result.detachedSaleItems = detached;
    }

    for (const locked of sales.filter(s => s.status === "draft")) {
      const removed = await InventorySaleItem.destroy({
        where: { companyId, saleId: locked.id, productId: product.id },
        transaction
      });
      result.removedDraftItems += removed;
      const remaining = await InventorySaleItem.count({
        where: { companyId, saleId: locked.id },
        transaction
      });
      if (remaining === 0 && !(await saleHasFinancialRecords(locked, transaction))) {
        await locked.destroy({ transaction });
        result.removedDraftSales += 1;
        continue;
      }
      await recalculateInventorySaleTotals(locked.id, companyId, transaction);
      const sale = await findInventorySaleOrThrow(companyId, locked.id, transaction);
      // Lança ERR_INVENTORY_SALE_PAYMENT_TOTAL_CONFLICT se o recebido passar do novo total.
      await syncDraftPendingAfterTotalChange(sale, transaction);
    }

    for (const sale of removableCancelled) {
      await sale.destroy({ transaction });
      result.removedCancelledSales += 1;
    }

    result.removedStockMovements = await InventoryStockMovement.destroy({
      where: { companyId, productId: product.id },
      transaction
    });

    try {
      await InventoryProductVariant.destroy({
        where: { companyId, productId: product.id },
        transaction
      });
      await product.destroy({ transaction });
    } catch (err) {
      // Referência criada em paralelo (ex.: item adicionado agora): nada é excluído.
      if (err instanceof ForeignKeyConstraintError) {
        throw new AppError("ERR_INVENTORY_PRODUCT_DELETE_CONFLICT", 409);
      }
      throw err;
    }
    return result;
  });
}
