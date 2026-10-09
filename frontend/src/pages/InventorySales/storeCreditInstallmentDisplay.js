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

/** Data civil local de `Date` → YYYY-MM-DD (componentes locais, sem UTC). */
export function todayCivilDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Combina data civil YYYY-MM-DD com o relógio local atual → ISO.
 * Usa construtor local (y, m-1, d, h, min…) — NÃO `new Date("YYYY-MM-DD")`
 * (que interpreta UTC e desloca o dia em fusos negativos).
 */
export function combineCivilDateWithLocalClockToIso(civilYmd, now = new Date()) {
  const m = String(civilYmd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const local = new Date(
    y,
    mo - 1,
    d,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
  if (Number.isNaN(local.getTime())) return null;
  // Guarda: componentes locais devem coincidir com a data civil escolhida.
  if (
    local.getFullYear() !== y ||
    local.getMonth() !== mo - 1 ||
    local.getDate() !== d
  ) {
    return null;
  }
  return local.toISOString();
}

/** Extrai YYYY-MM-DD local de um instante (ISO/Date) para asserts de timezone. */
export function civilDateFromLocalInstant(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return todayCivilDate(d);
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
