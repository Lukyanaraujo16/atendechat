/**
 * Mesma lógica do backend `getCompanyEffectivePlanValue` (override por empresa ou plan.value).
 */

export function getCompanyEffectivePlanValue(row) {
  const o = row?.contractedPlanValue;
  if (o !== null && o !== undefined && o !== "") {
    const n = Number(o);
    if (!Number.isNaN(n)) return n;
  }
  const pv = row?.plan?.value;
  const pn = Number(pv);
  return Number.isNaN(pn) ? 0 : pn;
}

export function formatBrlBrief(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
