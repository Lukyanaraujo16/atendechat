import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { i18n } from "../../translate/i18n";

/**
 * Formata data civil YYYY-MM-DD sem new Date() (evita deslocamento UTC).
 * pt/es → DD/MM/AAAA · en → MM/DD/YYYY
 */
export function formatCivilDueDate(value, language) {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(value);
  const [, y, mo, d] = m;
  const lang = String(language || i18n.language || "pt").slice(0, 2).toLowerCase();
  if (lang === "en") return `${mo}/${d}/${y}`;
  return `${d}/${mo}/${y}`;
}

/**
 * Linha de preview do cronograma de Crédito da Loja.
 * Não altera amounts/dueDate — só apresentação.
 */
export function formatStoreCreditInstallmentPreviewLine(inst, options = {}) {
  const language = options.language || i18n.language || "pt";
  const t = options.t || ((key, opts) => i18n.t(key, opts));
  const n = inst?.sequence != null ? inst.sequence : "—";
  const label = t("inventorySales.sales.wizard.payment.installmentLine", {
    n,
  });
  const due = formatCivilDueDate(inst?.dueDate, language);
  const amount = formatCurrencyBRL(inst?.amount);
  return `${label} · ${due} · ${amount}`;
}
