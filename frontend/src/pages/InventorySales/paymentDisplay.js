import { i18n } from "../../translate/i18n";
import { formatCardInstallmentCaption, formatCardPaymentLabel } from "./cardInstallments";
import { toNumber } from "./utils";

export function getInventoryPaymentMethodLabel(method) {
  if (!method) return i18n.t("inventorySales.sales.payment.noMethod");
  return i18n.t(`inventorySales.sales.paymentMethods.${method}`, method);
}

export function getInventoryPaymentStatusLabel(status) {
  if (status === "paid") {
    return i18n.t("inventorySales.sales.wizard.payment.statusPaid");
  }
  if (status === "pending") {
    return i18n.t("inventorySales.sales.wizard.payment.statusPending");
  }
  if (status === "reversed") {
    return i18n.t("inventorySales.sales.payment.statusReversed", "Estornado");
  }
  return i18n.t(`inventorySales.sales.paymentStatus.${status}`, status);
}

export function paymentLineCaption(payment) {
  const base = getInventoryPaymentMethodLabel(payment?.method);
  if (payment?.method === "credit_card" && payment?.cardInstallmentCount) {
    return `${base} — ${formatCardInstallmentCaption(
      payment.cardInstallmentCount,
      payment.amount
    )}`;
  }
  return base;
}

/** Caption compacta para recibo: "Cartão de crédito — 5x" */
export function paymentLineReceiptCaption(payment) {
  const base = getInventoryPaymentMethodLabel(payment?.method);
  if (payment?.method === "credit_card" && payment?.cardInstallmentCount) {
    const count = Number(payment.cardInstallmentCount);
    if (Number.isInteger(count) && count >= 1) {
      return `${base} — ${count}x`;
    }
  }
  return base;
}

/** true quando a venda provavelmente tem split e o cache de método único é inseguro */
export function saleLikelyHasMultiplePayments(sale) {
  if (sale?.paymentMethod) return false;
  const paid = toNumber(sale?.paidAmount);
  const status = sale?.paymentStatus;
  return (
    paid > 0 ||
    status === "paid" ||
    status === "partial" ||
    status === "unpaid"
  );
}

export function defaultPaymentStatusForMethod(method) {
  if (
    method === "cash" ||
    method === "pix" ||
    method === "credit_card" ||
    method === "debit_card" ||
    method === "bank_transfer"
  ) {
    return "paid";
  }
  // store_credit, boleto, other → pendente até liquidação / geração de recebível
  return "pending";
}

/**
 * Rótulo seguro para paymentMethod legado.
 * Quando o cache está null mas há valor financeiro, assume múltiplas formas
 * (P3) em vez de inventar um método único.
 */
export function describeSalePaymentMethod(sale) {
  const method = sale?.paymentMethod;
  if (method) {
    return formatCardPaymentLabel(
      getInventoryPaymentMethodLabel(method),
      method,
      sale?.cardInstallmentCount,
      sale?.totalAmount
    );
  }

  const paid = toNumber(sale?.paidAmount);
  const status = sale?.paymentStatus;
  if (
    paid > 0 ||
    status === "paid" ||
    status === "partial" ||
    status === "unpaid"
  ) {
    if (status === "unpaid" && paid <= 0) {
      return i18n.t("inventorySales.sales.payment.noMethod");
    }
    return i18n.t("inventorySales.sales.payment.multipleMethods");
  }

  return i18n.t("inventorySales.sales.payment.noMethod");
}
