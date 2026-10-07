import { i18n } from "../../translate/i18n";
import { formatCardPaymentLabel } from "./cardInstallments";
import { toNumber } from "./utils";

/**
 * Rótulo seguro para paymentMethod legado.
 * Quando o cache está null mas há valor financeiro, assume múltiplas formas
 * (P3) em vez de inventar um método único.
 */
export function describeSalePaymentMethod(sale) {
  const method = sale?.paymentMethod;
  if (method) {
    return formatCardPaymentLabel(
      i18n.t(`inventorySales.sales.paymentMethods.${method}`, method),
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
    // unpaid + null method = ainda sem forma (wizard sem permissão / vazio)
    if (status === "unpaid" && paid <= 0) {
      return i18n.t("inventorySales.sales.payment.noMethod");
    }
    return i18n.t("inventorySales.sales.payment.multipleMethods");
  }

  return i18n.t("inventorySales.sales.payment.noMethod");
}
