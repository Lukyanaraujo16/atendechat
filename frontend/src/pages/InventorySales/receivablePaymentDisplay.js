import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { i18n } from "../../translate/i18n";
import { getInventoryPaymentMethodLabel } from "./paymentDisplay";

/**
 * Rótulo inequívoco de linha de baixa / estorno (auditoria completa preservada).
 * - Recebimento ativo
 * - Recebimento estornado (marcação)
 * - Movimento de estorno (valor absoluto + rótulo Estorno)
 */
export function formatReceivablePaymentHistoryLine(payment, options = {}) {
  const method = getInventoryPaymentMethodLabel(payment?.paymentMethod);
  const absAmount = formatCurrencyBRL(Math.abs(Number(payment?.amount) || 0));
  const operator =
    options.includeOperator && payment?.createdByUser?.name
      ? ` · ${payment.createdByUser.name}`
      : "";
  const notes =
    options.includeNotes && payment?.notes
      ? ` · ${payment.notes}`
      : "";

  if (payment?.reverseOfPaymentId != null) {
    return `${i18n.t(
      "inventorySales.receivables.paymentKind.reversal"
    )} — ${method} — ${absAmount}${operator}${notes}`;
  }

  const base = `${i18n.t(
    "inventorySales.receivables.paymentKind.receipt"
  )} — ${method} — ${absAmount}`;

  if (payment?.reversedAt) {
    return `${base} — ${i18n.t(
      "inventorySales.receivables.paymentKind.reversed"
    )}${operator}${notes}`;
  }

  return `${base}${operator}${notes}`;
}
