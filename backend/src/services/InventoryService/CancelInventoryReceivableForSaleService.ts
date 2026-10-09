import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import InventoryReceivablePayment from "../../models/InventoryReceivablePayment";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

/**
 * Cancela saldo aberto do recebível da venda.
 * Conservador: se existir qualquer baixa não estornada, bloqueia o cancelamento.
 */
export default async function CancelInventoryReceivableForSaleService(input: {
  companyId: number;
  saleId: number;
  transaction: Transaction;
}): Promise<{ cancelledReceivableIds: number[]; releasedAmount: number }> {
  const receivables = await InventoryReceivable.findAll({
    where: {
      companyId: input.companyId,
      saleId: input.saleId,
      status: { [Op.in]: ["open", "partial", "paid"] }
    },
    transaction: input.transaction,
    lock: input.transaction.LOCK.UPDATE
  });

  const cancelledReceivableIds: number[] = [];
  let releasedAmount = 0;

  for (const receivable of receivables) {
    const activePayments = await InventoryReceivablePayment.count({
      where: {
        companyId: input.companyId,
        receivableId: receivable.id,
        reversedAt: null,
        reverseOfPaymentId: null,
        amount: { [Op.gt]: 0 }
      },
      transaction: input.transaction
    });

    if (activePayments > 0) {
      throw new AppError(
        "ERR_INVENTORY_SALE_CANCEL_RECEIVABLE_HAS_PAYMENTS",
        400,
        "Não é possível cancelar a venda: o Crédito da Loja já possui recebimentos. Estorne as baixas antes de cancelar."
      );
    }

    const installments = await InventoryReceivableInstallment.findAll({
      where: {
        companyId: input.companyId,
        receivableId: receivable.id,
        status: { [Op.in]: ["open", "partial"] }
      },
      transaction: input.transaction,
      lock: input.transaction.LOCK.UPDATE
    });

    for (const inst of installments) {
      releasedAmount = roundMoney(releasedAmount + toMoney(inst.openAmount));
      await inst.update(
        {
          openAmount: 0,
          status: "cancelled"
        },
        { transaction: input.transaction }
      );
    }

    // Parcelas já pagas (sem open) permanecem históricas; recebível vira cancelled
    // apenas se não houver saldo aberto — e sem baixas ativas (garantido acima).
    await receivable.update(
      {
        openAmount: 0,
        status: "cancelled"
      },
      { transaction: input.transaction }
    );
    cancelledReceivableIds.push(receivable.id);
  }

  return { cancelledReceivableIds, releasedAmount };
}
