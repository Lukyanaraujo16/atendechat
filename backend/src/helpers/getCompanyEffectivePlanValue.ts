/**
 * Valor usado em cobrança/financeiro: override por empresa ou valor padrão do plano.
 */
export function getCompanyEffectivePlanValue(company: {
  contractedPlanValue?: unknown;
  plan?: { value?: unknown } | null;
}): number {
  const o = company.contractedPlanValue;
  if (o !== null && o !== undefined && o !== "") {
    const n = typeof o === "string" ? parseFloat(o) : Number(o);
    if (!Number.isNaN(n)) return n;
  }
  const pv = company.plan?.value;
  if (pv === null || pv === undefined || pv === "") return 0;
  const pn = typeof pv === "string" ? parseFloat(pv) : Number(pv);
  return Number.isNaN(pn) ? 0 : pn;
}
