/**
 * Utilitários de formatação/parse do financeiro (Super Admin).
 * Datas de domínio trafegam como YYYY-MM-DD; a UI mostra dd/mm/aaaa.
 */
import moment from "moment";

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBrl(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return BRL.format(n);
}

/** Extrai YYYY-MM-DD de uma data de domínio (string date-only ou ISO) sem deslocar fuso. */
export function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = moment(value);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
}

/** Data de domínio (vencimento, competência do dia) → dd/mm/aaaa. */
export function formatDate(value) {
  const iso = toDateOnly(value);
  if (!iso) return "—";
  return moment(iso, "YYYY-MM-DD").format("DD/MM/YYYY");
}

/** Timestamp (createdAt, paidAt) → dd/mm/aaaa HH:mm no fuso do navegador. */
export function formatDateTime(value) {
  if (!value) return "—";
  const d = moment(value);
  return d.isValid() ? d.format("DD/MM/YYYY HH:mm") : "—";
}

/** Competência YYYY-MM → mm/aaaa. */
export function formatCompetence(value) {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : String(value);
}

/** Máscara de digitação dd/mm/aaaa. */
export function maskBrDate(input) {
  const digits = String(input || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** dd/mm/aaaa → YYYY-MM-DD (ou null se inválida). */
export function parseBrDate(text) {
  const m = String(text || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = moment(`${m[3]}-${m[2]}-${m[1]}`, "YYYY-MM-DD", true);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
}

/** YYYY-MM-DD → dd/mm/aaaa (para pré-preencher campos). */
export function isoToBrDate(value) {
  const iso = toDateOnly(value);
  return iso ? moment(iso, "YYYY-MM-DD").format("DD/MM/YYYY") : "";
}

/** Máscara de competência mm/aaaa. */
export function maskCompetence(input) {
  const digits = String(input || "")
    .replace(/\D/g, "")
    .slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** mm/aaaa → YYYY-MM (null se inválida; "" se vazio). */
export function parseCompetence(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const m = t.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return null;
  return `${m[2]}-${m[1]}`;
}

export function competenceToBr(value) {
  if (!value) return "";
  const m = String(value).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : "";
}

/**
 * Máscara de moeda brasileira enquanto digita: só dígitos, tratados como centavos.
 * "123456" → "1.234,56"
 */
export function maskBrl(input) {
  const digits = String(input || "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 12);
  if (!digits) return "";
  const cents = Number(digits);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** "1.234,56" → 1234.56 (null se vazio/inválido). */
export function parseBrl(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const normalized = t.replace(/[^\d,-]/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Número (reais) → texto para o campo mascarado. */
export function numberToBrlInput(value) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) {
    return "";
  }
  return maskBrl(String(Math.round(n * 100)));
}

export function toCents(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

const RECURRENCE_LABELS = {
  MENSAL: "Mensal (1 mês)",
  BIMESTRAL: "Bimestral (2 meses)",
  TRIMESTRAL: "Trimestral (3 meses)",
  SEMESTRAL: "Semestral (6 meses)",
  ANUAL: "Anual (12 meses)",
};

export function recurrenceLabel(recurrence, months) {
  const key = String(recurrence || "").toUpperCase();
  if (RECURRENCE_LABELS[key]) return RECURRENCE_LABELS[key];
  if (Number(months) > 0) {
    return `${months} ${Number(months) === 1 ? "mês" : "meses"}`;
  }
  return recurrence || "Não definida";
}

/** Situação na Efí: rótulo curto + explicação (tooltip). */
const SYNC_INFO = {
  synced: {
    label: "Sincronizada com a Efí",
    help: "A Efí confirmou a situação desta cobrança.",
    tone: "success",
  },
  pending: {
    label: "Aguardando conciliação",
    help: "A baixa foi registrada aqui e aguarda confirmação/conciliação com a Efí.",
    tone: "warning",
  },
  failed: {
    label: "Falha ao sincronizar — requer conciliação",
    help: "Não foi possível refletir esta operação na Efí. Verifique a guia Conciliação.",
    tone: "error",
  },
  unsupported: {
    label: "Baixa somente local (Pix não permite baixa manual na Efí)",
    help: "A Efí não oferece baixa manual para Pix. O registro vale somente neste sistema.",
    tone: "info",
  },
  none: {
    label: "Sem cobrança na Efí",
    help: "Nenhuma cobrança foi emitida na Efí para este registro.",
    tone: "default",
  },
};

export function syncInfo(status) {
  const s = String(status || "").toLowerCase();
  return SYNC_INFO[s] || SYNC_INFO.none;
}

export const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "transfer", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "credit_card", label: "Cartão" },
  { value: "cash", label: "Dinheiro" },
  { value: "other", label: "Outro" },
];

/** Formas de pagamento da regularização histórica (inclui "Não sei"). */
export const HISTORICAL_PAYMENT_METHODS = [
  ...PAYMENT_METHODS,
  { value: "unknown", label: "Não sei" },
];

export function methodLabel(method) {
  const found = PAYMENT_METHODS.find((m) => m.value === String(method || "").toLowerCase());
  if (found) return found.label;
  const key = String(method || "").toLowerCase();
  if (key === "card") return "Cartão";
  if (key === "courtesy") return "Cortesia";
  if (key === "unknown") return "Não informada";
  return method || "—";
}

const SOURCE_LABELS = {
  paid_offline: "Recebimento manual",
  courtesy: "Cortesia",
  gateway: "Efí (automático)",
  manual: "Manual",
  historical_payment: "Pagamento histórico (regularização)",
  historical_courtesy: "Cortesia histórica (regularização)",
};

/**
 * Categoria visual do pagamento: atual (dinheiro recebido agora), histórico
 * (regularização de fatura antiga, sem renovação), cortesia ou cortesia histórica.
 */
export function paymentCategory(source, countsAsRevenue) {
  const s = String(source || "").toLowerCase();
  if (s === "historical_payment") return "historical";
  if (s === "historical_courtesy") return "historical_courtesy";
  if (s === "courtesy" || countsAsRevenue === false) return "courtesy";
  return "current";
}

/**
 * Data de pagamento confirmado da central de assinatura: vem como YYYY-MM-DD
 * (sem hora) → dd/mm/aaaa. Se vier ISO com hora, mostra só a data também.
 */
export function formatPaidDate(paidAt, paidAtUnknown) {
  if (!paidAt || paidAtUnknown) return "data não informada";
  if (typeof paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(paidAt)) return formatDate(paidAt);
  const d = moment(paidAt);
  return d.isValid() ? d.format("DD/MM/YYYY") : "—";
}

/** Data de pagamento: desconhecida → "data não informada". */
export function formatPaidAt(paidAt, paidAtUnknown) {
  if (!paidAt || paidAtUnknown) return "data não informada";
  return formatDateTime(paidAt);
}

export function sourceLabel(source) {
  return SOURCE_LABELS[String(source || "").toLowerCase()] || source || "—";
}

const INVOICE_STATUS = {
  open: "Aberta",
  paid: "Paga",
  cancelled: "Cancelada",
  canceled: "Cancelada",
  courtesy: "Cortesia",
};

export function invoiceStatusLabel(status) {
  return INVOICE_STATUS[String(status || "").toLowerCase()] || status || "—";
}

/**
 * Rótulos dos eventType gravados pelo backend no livro-razão financeiro
 * (SaaSFinancialEvents). Chaves antigas mantidas por compatibilidade.
 */
const EVENT_LABELS = {
  // Faturas
  invoice_created: "Fatura gerada",
  invoice_created_manual: "Fatura criada manualmente",
  invoice_updated: "Fatura editada",
  invoice_cancelled: "Fatura cancelada",
  // Pagamentos
  manual_payment_recorded: "Pagamento registrado manualmente",
  courtesy_granted: "Cortesia concedida (sem receita)",
  payment_confirmed_gateway: "Pagamento confirmado pela Efí",
  gateway_payment_on_settled_invoice: "Pix recebido em fatura já quitada (possível duplicidade)",
  gateway_settle_retry_success: "Baixa na Efí concluída após nova tentativa",
  gateway_settle_failed: "Falha ao dar baixa na Efí",
  // Renovações da assinatura
  renewal_payment_confirmed: "Assinatura renovada (pagamento confirmado)",
  renewal_paid_offline: "Assinatura renovada (pagamento manual)",
  renewal_courtesy: "Assinatura renovada (cortesia, sem receita)",
  renewal_manual_renew: "Renovação administrativa (sem receita)",
  renewal_due_date_adjustment: "Vencimento ajustado",
  renewal_skipped_period_already_covered: "Renovação não aplicada (período já coberto)",
  // Regularização de faturas históricas
  historical_payment_recorded: "Pagamento histórico regularizado (sem renovação)",
  historical_courtesy_recorded: "Cortesia histórica regularizada (sem receita)",
  historical_invoice_cancelled: "Fatura antiga cancelada como cobrança indevida",
  historical_review_kept_pending: "Fatura antiga revisada — mantida pendente",
  // Compatibilidade com nomes antigos
  payment_registered: "Pagamento registrado",
  manual_payment: "Pagamento registrado manualmente",
  subscription_renewed: "Assinatura renovada",
  renewal: "Assinatura renovada",
  due_date_adjusted: "Vencimento ajustado",
  historical_payment: "Pagamento histórico regularizado (sem renovação)",
  historical_courtesy: "Cortesia histórica regularizada (sem receita)",
  historical_improper_cancel: "Fatura antiga cancelada como cobrança indevida",
  historical_keep_pending: "Fatura antiga revisada — mantida pendente",
};

export function eventLabel(type) {
  const key = String(type || "").toLowerCase();
  if (EVENT_LABELS[key]) return EVENT_LABELS[key];
  if (!key) return "—";
  if (key.startsWith("renewal_skipped_")) return "Renovação não aplicada";
  if (key.startsWith("renewal_")) return "Assinatura renovada";
  if (key.startsWith("historical_")) return "Regularização de fatura antiga";
  if (key.startsWith("invoice_")) return "Alteração na fatura";
  if (key.startsWith("gateway_")) return "Evento da Efí";
  return "Outro evento financeiro";
}

const RENEWAL_REASONS = {
  payment_confirmed: "Pagamento confirmado",
  paid_offline: "Pagamento manual",
  courtesy: "Cortesia",
  manual_renew: "Renovação administrativa (sem receita)",
  due_date_adjustment: "Ajuste de vencimento",
};

export function renewalReasonLabel(reason) {
  return RENEWAL_REASONS[String(reason || "").toLowerCase()] || reason || "—";
}

const RECON_KIND = {
  manual_settle_divergence: "Baixa manual não refletida na Efí",
  manual_pix_no_settle: "Pix recebido fora da Efí — baixa somente local",
  gateway_payment_on_settled_invoice: "Possível pagamento em duplicidade",
  gateway_payment_renewal_failed: "Pix registrado, mas a assinatura não foi renovada",
};

export function reconKindLabel(kind) {
  const key = String(kind || "").toLowerCase();
  if (RECON_KIND[key]) return RECON_KIND[key];
  if (!key) return "—";
  return "Pendência de conciliação";
}

const RECON_STATUS = {
  open: "Pendente",
  pending: "Pendente",
  retrying: "Em nova tentativa",
  failed: "Falhou",
  resolved: "Resolvida",
};

export function reconStatusLabel(status) {
  return RECON_STATUS[String(status || "").toLowerCase()] || status || "—";
}

/** Código de erro da API ({ error: "ERR_..." }). */
export function errorCode(err) {
  return err?.response?.data?.error || null;
}

export function httpStatus(err) {
  return err?.response?.status || null;
}

export function isNotFoundRoute(err) {
  // 404 sem código de domínio = rota ainda não disponível no servidor.
  return httpStatus(err) === 404 && !errorCode(err);
}

/** Erros financeiros com mensagens claras em pt-BR. */
const FINANCE_ERRORS = {
  ERR_RENEWAL_STALE:
    "O vencimento já foi alterado por outra operação — recarregue antes de renovar.",
  ERR_RENEWAL_REASON_REQUIRED: "Informe a justificativa da renovação.",
  ERR_PAYMENT_AMOUNT_INSUFFICIENT:
    "O valor recebido é menor que o valor da fatura. Pagamento parcial não é suportado; edite a fatura se houve desconto acordado.",
  ERR_PAYMENT_AMOUNT_EXCEEDS:
    "O valor recebido é maior que o valor da fatura. Pagamento acima do devido não é suportado; edite a fatura se o valor acordado mudou.",
  ERR_INVOICE_NOT_OPEN:
    "Esta fatura não está mais em aberto (já foi paga ou cancelada). Recarregue a lista.",
  ERR_INVOICE_CYCLE_DUPLICATE:
    "Já existe uma fatura para esta competência/ciclo. Edite a fatura existente em vez de gerar outra.",
  ERR_INVOICE_NOT_EDITABLE:
    "Esta fatura não pode ser editada: somente faturas em aberto, sem pagamentos e sem cobrança ativa na Efí.",
  ERR_INVOICE_NOT_FOUND: "Fatura não encontrada. Recarregue a lista.",
  ERR_PAYMENT_STATE_CHANGED:
    "Os dados da assinatura mudaram desde a prévia (outra operação alterou o vencimento). Revise a prévia antes de confirmar.",
  ERR_RENEWAL_DUPLICATE:
    "Esta operação já foi aplicada por outra tela ou outro administrador. Recarregue para ver a situação atual.",
  ERR_RENEWAL_TOO_SOON:
    "Uma renovação acabou de ser feita para esta empresa. Aguarde alguns segundos e recarregue.",
  ERR_INVALID_DUE_DATE: "Data de vencimento inválida.",
  ERR_CANNOT_CANCEL_PAID_INVOICE:
    "Esta fatura já foi paga e não pode ser cancelada. Atualize a página.",
  ERR_CANNOT_CANCEL_INVOICE_WITH_PAYMENT:
    "Esta fatura já tem pagamento registrado e não pode ser cancelada. Atualize a página.",
  ERR_CANCEL_REASON_REQUIRED: "Informe o motivo do cancelamento.",
  ERR_INVALID_COMPANY: "Empresa inválida ou não encontrada. Atualize a página.",
  ERR_HISTORICAL_ALREADY_REVIEWED:
    "Esta fatura já foi regularizada (talvez por outro administrador). Recarregue a lista.",
  ERR_HISTORICAL_NOT_ELIGIBLE:
    "Esta fatura não é candidata à regularização histórica (já tem pagamento ou decisão registrada).",
  ERR_HISTORICAL_EFI_CONFLICT:
    "Esta fatura tem pagamento ou cobrança na Efí (confirmada ou aguardando conciliação). Resolva primeiro pela guia Conciliação — não regularize manualmente.",
  ERR_HISTORICAL_PAID_AT_REQUIRED:
    "Informe a data real do pagamento ou marque “Não sei a data”.",
  ERR_HISTORICAL_SOURCE_REQUIRED: "Informe como o pagamento foi confirmado (fonte da confirmação).",
  ERR_HISTORICAL_EFI_ACK_REQUIRED:
    "Esta fatura tem cobrança Efí gerada: confirme que você verificou a cobrança na Efí.",
};

export function financeErrorMessage(err) {
  const code = errorCode(err);
  if (code && FINANCE_ERRORS[code]) return FINANCE_ERRORS[code];
  return null;
}

/** Mensagem conhecida, senão a `message` pt-BR do backend, senão null. */
export function apiErrorMessage(err) {
  return financeErrorMessage(err) || err?.response?.data?.message || null;
}
