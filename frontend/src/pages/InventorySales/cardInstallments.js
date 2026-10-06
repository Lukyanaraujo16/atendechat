import { i18n } from "../../translate/i18n";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";

export const CARD_INSTALLMENT_MIN = 1;
export const CARD_INSTALLMENT_MAX = 18;

export const CARD_INSTALLMENT_OPTIONS = Array.from(
  { length: CARD_INSTALLMENT_MAX },
  (_, index) => index + 1
);

export function displayCardInstallmentCount(raw) {
  const count = Number(raw);
  if (
    Number.isInteger(count) &&
    count >= CARD_INSTALLMENT_MIN &&
    count <= CARD_INSTALLMENT_MAX
  ) {
    return count;
  }
  return 1;
}

export function cardInstallmentFormValue(paymentMethod, raw) {
  if (paymentMethod !== "credit_card") return "";
  const count = Number(raw);
  if (
    Number.isInteger(count) &&
    count >= CARD_INSTALLMENT_MIN &&
    count <= CARD_INSTALLMENT_MAX
  ) {
    return String(count);
  }
  return "1";
}

/** Divisão exata em centavos. Caso contrário, mostra só a quantidade e o total. */
export function formatCardInstallmentCaption(count, totalAmount) {
  const safeCount = Number(count);
  const cents = Math.round(Number(totalAmount) * 100);
  if (!Number.isInteger(safeCount) || safeCount < 1 || !Number.isFinite(cents)) {
    return `${safeCount}x`;
  }
  if (cents % safeCount === 0) {
    return i18n.t("inventorySales.sales.payment.installmentsExact", {
      times: safeCount,
      amount: formatCurrencyBRL(cents / safeCount / 100),
    });
  }
  return i18n.t("inventorySales.sales.payment.installmentsOfTotal", {
    times: safeCount,
    amount: formatCurrencyBRL(cents / 100),
  });
}

export function formatCardPaymentLabel(
  methodLabel,
  paymentMethod,
  rawCount,
  totalAmount
) {
  if (paymentMethod !== "credit_card") return methodLabel;
  const count = displayCardInstallmentCount(rawCount);
  return `${methodLabel} — ${formatCardInstallmentCaption(count, totalAmount)}`;
}
