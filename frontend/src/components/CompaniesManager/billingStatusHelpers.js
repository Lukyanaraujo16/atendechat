/**
 * Rótulos e filtros da situação financeira vinda do backend (Fase 8.4-F).
 * Contratos: C1/C2 (motor de avaliação e status em lote) e C5 (resumo de faturas históricas).
 * Textos em pt-BR simples — o usuário final é o operador financeiro (Super Admin).
 */

export const FINANCIAL_STATUS_LABELS = {
  sem_vencimento: "Sem vencimento",
  em_dia: "Em dia",
  vence_hoje: "Vence hoje",
  carencia: "Em carência",
  vencido: "Vencido",
};

export const BLOCK_KIND_LABELS = {
  none: "",
  manual: "Bloqueado manualmente",
  financial: "Bloqueado por inadimplência",
  unknown: "Bloqueado (origem não identificada)",
};

/** Tom visual (success | warning | error | info | default) da situação financeira. */
export function financialStatusTone(status) {
  switch (status) {
    case "em_dia":
      return "success";
    case "vence_hoje":
    case "carencia":
      return "warning";
    case "vencido":
      return "error";
    default:
      return "default";
  }
}

export function financialStatusLabel(status) {
  return FINANCIAL_STATUS_LABELS[status] || "—";
}

export function blockKindLabel(kind) {
  return BLOCK_KIND_LABELS[kind] || "";
}

/** Filtros operacionais da listagem de empresas (combinam com busca e filtros de vencimento). */
export const OPERATIONAL_FILTERS = [
  {
    key: "em_dia",
    label: "Em dia",
    hint: "Vencimento no futuro ou hoje.",
    match: (st) => st?.financialStatus === "em_dia" || st?.financialStatus === "vence_hoje",
  },
  {
    key: "vencido",
    label: "Vencido",
    hint: "Atraso já passou do prazo de bloqueio configurado na automação de cobrança.",
    match: (st) => st?.financialStatus === "vencido",
  },
  {
    key: "carencia",
    label: "Em carência",
    hint: "Atrasada, mas ainda dentro do prazo antes do bloqueio.",
    match: (st) => st?.financialStatus === "carencia",
  },
  {
    key: "blocked_financial",
    label: "Bloqueado financeiramente",
    hint: "Bloqueada pela automação por falta de pagamento.",
    match: (st) => st?.blockKind === "financial",
  },
  {
    key: "blocked_manual",
    label: "Bloqueado manualmente",
    hint: "Bloqueada por um administrador. Pagamento não desbloqueia sozinho.",
    match: (st) => st?.blockKind === "manual",
  },
  {
    key: "historical",
    label: "Faturas históricas a revisar",
    hint: "Empresas com faturas antigas que precisam de uma decisão antes de cobrar.",
    match: (_st, historicalCount) => Number(historicalCount) > 0,
  },
];

/**
 * Indexa a resposta de GET /saas/companies/billing-status por companyId.
 * Aceita `{ companies: [...] }` ou um array direto.
 */
export function indexBillingStatus(payload) {
  const list = Array.isArray(payload) ? payload : payload?.companies;
  const map = {};
  if (!Array.isArray(list)) return map;
  list.forEach((item) => {
    if (item && item.companyId != null) map[String(item.companyId)] = item;
  });
  return map;
}

/** Normaliza GET /saas/finance/historical-review/summary → { total, byCompany }. */
export function normalizeHistoricalSummary(payload) {
  const byCompany = {};
  const raw = payload?.byCompany || {};
  Object.keys(raw).forEach((k) => {
    const n = Number(raw[k]) || 0;
    if (n > 0) byCompany[String(k)] = n;
  });
  const total = Number(payload?.total);
  return {
    total: Number.isFinite(total) ? total : Object.values(byCompany).reduce((a, b) => a + b, 0),
    byCompany,
  };
}

/** "YYYY-MM-DD" (ou ISO) → "DD/MM/YYYY". */
export function formatDomainDate(value) {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(value);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Caminho da fila de revisão histórica, opcionalmente filtrada por empresa.
 * Abre sempre em "Não resolvidas" (pendentes + mantidas pendentes), o mesmo
 * conjunto contado pelo resumo — assim o número exibido bate com a lista.
 */
export function historicalReviewPath(companyId) {
  const base = "/saas/finance/historical-review";
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", String(companyId));
  params.set("state", "unresolved");
  return `${base}?${params.toString()}`;
}
