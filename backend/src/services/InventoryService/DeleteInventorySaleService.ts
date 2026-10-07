import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import {
  assertInventorySaleIsDraft,
  findInventorySaleOrThrow,
  toMoney
} from "./inventorySaleHelpers";
import {
  bootstrapLegacyPaymentsIfNeeded,
  buildPaymentFinancialSummary,
  listSalePayments
} from "./inventorySalePaymentEngine";

/** Remove venda em rascunho e itens (cascade). Bloqueia se houver valor recebido. */
export default async function DeleteInventorySaleService(input: {
  companyId: number;
  id: number;
}): Promise<void> {
  await sequelize.transaction(async (t: Transaction) => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.id,
      t,
      t.LOCK.UPDATE
    );
    assertInventorySaleIsDraft(sale, "ser excluída");

    await bootstrapLegacyPaymentsIfNeeded(sale, t, null);
    const payments = await listSalePayments(sale.companyId, sale.id, t);
    const summary = buildPaymentFinancialSummary(sale.totalAmount, payments);
    if (summary.effectivePaid > 0 || toMoney(sale.paidAmount) > 0) {
      throw new AppError(
        "ERR_INVENTORY_SALE_DELETE_WITH_PAID",
        400,
        "Esta venda possui pagamento registrado e não pode ser excluída."
      );
    }

    await sale.destroy({ transaction: t });
  });
}
