import AppError from "../../errors/AppError";
import { InventoryPaymentStatus } from "../../models/InventorySale";
import { InventorySalePaymentLineStatus } from "../../models/InventorySalePayment";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export type PaymentLineForAggregate = {
  amount: string | number;
  status: InventorySalePaymentLineStatus | string;
};

export type SalePaymentAggregate = {
  effectivePaid: number;
  paymentStatus: InventoryPaymentStatus;
  pendingAmount: number;
};

/**
 * Agregado financeiro a partir das linhas de pagamento.
 * P1: helper puro — NÃO conectado à escrita runtime.
 *
 * - pending: intenção, NÃO soma como recebido
 * - paid: soma
 * - reversed: NÃO soma (linha inativa; estorno operacional é P futura)
 */
export function calculateSalePaymentAggregate(
  totalAmount: string | number,
  payments: PaymentLineForAggregate[]
): SalePaymentAggregate {
  const total = roundMoney(toMoney(totalAmount));
  let effectivePaid = 0;

  for (const row of payments || []) {
    if (row.status === "paid") {
      effectivePaid = roundMoney(effectivePaid + toMoney(row.amount));
    }
  }

  if (effectivePaid > total) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_OVERPAYMENT",
      400,
      "Soma dos pagamentos pagos excede o total da venda."
    );
  }

  let paymentStatus: InventoryPaymentStatus;
  if (effectivePaid <= 0) {
    paymentStatus = "unpaid";
  } else if (effectivePaid === total) {
    paymentStatus = "paid";
  } else {
    paymentStatus = "partial";
  }

  return {
    effectivePaid,
    paymentStatus,
    pendingAmount: roundMoney(total - effectivePaid)
  };
}
