import { Op, Transaction, literal } from "sequelize";
import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import Company from "../../models/Company";
import CompanyLog from "../../models/CompanyLog";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import SaaSInvoiceHistoricalReview from "../../models/SaaSInvoiceHistoricalReview";
import User from "../../models/User";
import {
  instantToDomainDate,
  resolveSaasTimezone,
  toDomainDate,
  todayDomainDate
} from "../../helpers/saasDueDate";
import { computeInvoiceCoverageEnd } from "./computeNextDueDate";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { cancelLockedInvoice } from "./cancelSaasInvoice";

/**
 * Fase 8.4-F (F3/F4) — regularização histórica de faturas SaaS (contrato C5).
 *
 * Contexto: antes da central financeira, clientes pagavam direto ao operador e a assinatura era
 * renovada administrativamente sem baixa nas faturas. O operador revisa UMA fatura por vez.
 *
 * Regras invariáveis:
 * - nada é automático ou em massa; a data de referência só CLASSIFICA candidatas, nunca quita;
 * - NENHUMA decisão renova a assinatura (este módulo não importa o motor de renovação);
 * - nada é inventado: data real ou explicitamente desconhecida (paidAt NULL), valor exato da fatura,
 *   forma de pagamento informada (ou "unknown" explícito);
 * - prévia e execução usam a MESMA função (`evaluateHistoricalReview`), a execução revalida tudo
 *   dentro da transação com lock FOR UPDATE da fatura.
 */

export const HISTORICAL_REVIEW_REFERENCE_DATE = "2026-10-17";

export const HISTORICAL_DECISIONS = [
  "historical_payment",
  "improper_cancel",
  "historical_courtesy",
  "keep_pending"
] as const;
export type HistoricalDecision = typeof HISTORICAL_DECISIONS[number];

export const HISTORICAL_METHODS = [
  "pix",
  "transfer",
  "cash",
  "boleto",
  "credit_card",
  "other",
  "unknown"
] as const;

const DOMAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TERMINAL_UNIQUE_INDEX = "saas_hist_reviews_terminal_unique";

const LEDGER_EVENT: Record<HistoricalDecision, string> = {
  historical_payment: "historical_payment_recorded",
  historical_courtesy: "historical_courtesy_recorded",
  improper_cancel: "historical_invoice_cancelled",
  keep_pending: "historical_review_kept_pending"
};

export function isTerminalDecision(decision: string | null | undefined): boolean {
  return !!decision && decision !== "keep_pending";
}

/** Data de referência (YYYY-MM-DD). Override por `SAAS_HISTORICAL_REFERENCE_DATE` se válido. */
export function getHistoricalReferenceDate(): string {
  const env = String(process.env.SAAS_HISTORICAL_REFERENCE_DATE || "").trim();
  if (DOMAIN_DATE_RE.test(env) && moment(env, "YYYY-MM-DD", true).isValid()) {
    return env;
  }
  return HISTORICAL_REVIEW_REFERENCE_DATE;
}

function isOpenStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase();
  return s !== "paid" && s !== "cancelled";
}

function toCents(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

type InvoiceLike = {
  status?: string | null;
  createdAt?: Date | string | null;
  legacyUnknown?: boolean | null;
  cycleKey?: string | null;
  /** Opcional: quando informado (> 0) a fatura não é candidata (já tem pagamento). */
  paymentsCount?: number | null;
  /** Opcional: quando true a fatura não é candidata (já tem decisão terminal). */
  hasTerminalReview?: boolean | null;
};

/**
 * Classificação pura (sem I/O) de fatura candidata à regularização histórica:
 * status não paid/cancelled E (createdAt < referência no fuso da empresa OU legacyUnknown OU cycleKey nulo).
 * Pagamento registrado / decisão terminal só podem ser checados com I/O: se o chamador souber,
 * informe `paymentsCount` / `hasTerminalReview` no objeto (o serviço sempre checa no banco).
 */
export function isHistoricalCandidate(
  invoice: InvoiceLike | null | undefined,
  company?: { timezone?: string | null } | null,
  opts?: { referenceDate?: string }
): boolean {
  if (!invoice) return false;
  if (!isOpenStatus(invoice.status)) return false;
  if (Number(invoice.paymentsCount || 0) > 0) return false;
  if (invoice.hasTerminalReview === true) return false;
  if (invoice.legacyUnknown === true) return true;
  if (!invoice.cycleKey) return true;
  const ref = opts?.referenceDate || getHistoricalReferenceDate();
  const created = instantToDomainDate(invoice.createdAt as any, company?.timezone);
  return !!created && created < ref;
}

export type HistoricalSignals = {
  coveredByCurrentDueDate: boolean;
  currentDueDate: string | null;
  invoiceCoverageEnd: string | null;
  adminRenewalsAfterDue: number;
  efiCharge: boolean;
  pendingReconciliation: boolean;
};

export function computeSignals(params: {
  invoice: any;
  company: any;
  renewLogDates: Array<Date | string>;
  pendingReconciliation: boolean;
}): HistoricalSignals {
  const { invoice, company } = params;
  const tz = resolveSaasTimezone(company?.timezone);
  const currentDueDate = toDomainDate(company?.dueDate, tz);
  const invoiceCoverageEnd = computeInvoiceCoverageEnd(
    invoice.dueDate,
    invoice.recurrenceSnapshot || company?.recurrence,
    tz
  );
  const invoiceDue = toDomainDate(invoice.dueDate, tz);
  const adminRenewalsAfterDue = invoiceDue
    ? params.renewLogDates.filter(d => {
        const day = instantToDomainDate(d as any, tz); // instante do log, no fuso da empresa
        return !!day && day >= invoiceDue;
      }).length
    : 0;
  return {
    coveredByCurrentDueDate:
      !!currentDueDate && !!invoiceCoverageEnd && currentDueDate >= invoiceCoverageEnd,
    currentDueDate,
    invoiceCoverageEnd,
    adminRenewalsAfterDue,
    efiCharge: !!(invoice.externalTxid || invoice.externalChargeId),
    pendingReconciliation: params.pendingReconciliation
  };
}

export type HistoricalReviewInput = {
  decision?: unknown;
  note?: unknown;
  confirmationSource?: unknown;
  paidAt?: unknown;
  paidAtUnknown?: unknown;
  amount?: unknown;
  method?: unknown;
  efiChargeAcknowledged?: unknown;
};

export type PlanIssue = { code: string; message: string; status: number };

export type HistoricalReviewContext = {
  invoice: any;
  company: any;
  payments: Array<{ source?: string | null }>;
  terminalReview: { decision: string } | null;
  keptPendingCount: number;
  signals: HistoricalSignals;
  referenceDate: string;
  today: string;
};

export type HistoricalReviewPlan = {
  valid: boolean;
  errors: PlanIssue[];
  alerts: Array<{ code: string; message: string }>;
  decision: HistoricalDecision | null;
  revenueEffect: "revenue" | "no_revenue";
  invoiceStatusAfter: string;
  willRenew: false;
  payment: { amount: number; paidAt: string | null; paidAtUnknown: boolean } | null;
  /** Valores normalizados usados pela execução. */
  normalized: {
    note: string;
    confirmationSource: string | null;
    paidAt: string | null;
    paidAtUnknown: boolean;
    amount: number | null;
    method: string | null;
    efiChargeAcknowledged: boolean;
  };
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Função ÚNICA de validação/planejamento (pura). Usada pela prévia e pela execução
 * (esta com o contexto recarregado sob lock). Nunca decide com base em indícios.
 */
export function evaluateHistoricalReview(
  ctx: HistoricalReviewContext,
  input: HistoricalReviewInput
): HistoricalReviewPlan {
  const errors: PlanIssue[] = [];
  const alerts: Array<{ code: string; message: string }> = [];
  const err = (code: string, status: number, message: string) =>
    errors.push({ code, status, message });

  const rawDecision = str(input.decision);
  const decision = (HISTORICAL_DECISIONS as readonly string[]).includes(rawDecision)
    ? (rawDecision as HistoricalDecision)
    : null;
  const terminal = isTerminalDecision(decision);
  const { invoice, signals } = ctx;
  const invoiceCents = toCents(invoice.value);
  const invoiceAmount = invoiceCents === null ? null : invoiceCents / 100;

  const note = str(input.note);
  const confirmationSource = str(input.confirmationSource) || null;
  const efiChargeAcknowledged = input.efiChargeAcknowledged === true;
  const paidAtRaw = input.paidAt === undefined || input.paidAt === null ? "" : String(input.paidAt).trim();
  const paidAtUnknown = input.paidAtUnknown === true;
  let paidAt: string | null = null;
  let amount: number | null = null;
  let method: string | null = null;

  // ---- Estado (409) -------------------------------------------------------------------------
  if (ctx.terminalReview) {
    err(
      "ERR_HISTORICAL_ALREADY_REVIEWED",
      409,
      `Esta fatura já foi regularizada (decisão: ${ctx.terminalReview.decision}).`
    );
  }
  const gatewayPayment = ctx.payments.some(p => String(p.source || "") === "gateway");
  const gatewayConcluded = String(invoice.gatewayStatus || "").toUpperCase() === "CONCLUIDA";
  if (terminal && (gatewayPayment || gatewayConcluded || signals.pendingReconciliation)) {
    err(
      "ERR_HISTORICAL_EFI_CONFLICT",
      409,
      "A Efí indica pagamento ou há conciliação pendente para esta fatura. Resolva pela conciliação, não pela regularização histórica."
    );
  }
  if (!isOpenStatus(invoice.status)) {
    err("ERR_INVOICE_NOT_OPEN", 409, "A fatura não está em aberto.");
  } else if (ctx.payments.length > 0) {
    err(
      "ERR_HISTORICAL_NOT_ELIGIBLE",
      409,
      "A fatura já possui pagamento registrado; regularizar duplicaria a receita."
    );
  } else if (
    !isHistoricalCandidate(invoice, ctx.company, { referenceDate: ctx.referenceDate })
  ) {
    err(
      "ERR_HISTORICAL_NOT_ELIGIBLE",
      409,
      `A fatura não é histórica (criada a partir de ${ctx.referenceDate}, com ciclo definido). Use a baixa normal.`
    );
  }

  // ---- Entrada (400) ------------------------------------------------------------------------
  if (!decision) {
    err(
      "ERR_HISTORICAL_INVALID_DECISION",
      400,
      "Decisão inválida (historical_payment, improper_cancel, historical_courtesy ou keep_pending)."
    );
  }
  if (note.length < 5) {
    err("ERR_HISTORICAL_NOTE_REQUIRED", 400, "Informe a observação (mínimo 5 caracteres).");
  }

  const needsSource = decision === "historical_payment" || decision === "historical_courtesy";
  if (needsSource && !confirmationSource) {
    err(
      "ERR_HISTORICAL_SOURCE_REQUIRED",
      400,
      "Informe onde o pagamento/cortesia foi confirmado (ex.: extrato, comprovante, conversa)."
    );
  }

  const validatePaidAtDate = () => {
    if (!DOMAIN_DATE_RE.test(paidAtRaw) || !moment(paidAtRaw, "YYYY-MM-DD", true).isValid()) {
      err("ERR_HISTORICAL_PAID_AT_INVALID", 400, "Data de pagamento inválida (use YYYY-MM-DD).");
      return;
    }
    if (paidAtRaw > ctx.today) {
      err("ERR_HISTORICAL_PAID_AT_INVALID", 400, "A data de pagamento não pode estar no futuro.");
      return;
    }
    paidAt = paidAtRaw;
  };

  if (decision === "historical_payment") {
    if ((paidAtRaw && paidAtUnknown) || (!paidAtRaw && !paidAtUnknown)) {
      err(
        "ERR_HISTORICAL_PAID_AT_REQUIRED",
        400,
        "Informe a data real do pagamento OU marque explicitamente que a data é desconhecida (não ambos)."
      );
    } else if (paidAtRaw) {
      validatePaidAtDate();
    }

    const amountCents = toCents(input.amount);
    if (input.amount === undefined || input.amount === null || input.amount === "") {
      err(
        "ERR_HISTORICAL_AMOUNT_REQUIRED",
        400,
        "Confirme o valor recebido (deve ser igual ao valor da fatura)."
      );
    } else if (amountCents === null || invoiceCents === null) {
      err("ERR_HISTORICAL_AMOUNT_REQUIRED", 400, "Valor recebido inválido.");
    } else if (amountCents < invoiceCents) {
      err(
        "ERR_PAYMENT_AMOUNT_INSUFFICIENT",
        400,
        "Valor menor que o da fatura. Pagamento parcial não é suportado; ajuste a fatura antes, se houve desconto."
      );
    } else if (amountCents > invoiceCents) {
      err("ERR_PAYMENT_AMOUNT_EXCEEDS", 400, "Valor maior que o da fatura.");
    } else {
      amount = amountCents / 100;
    }

    const m = str(input.method);
    if (!m) {
      err(
        "ERR_HISTORICAL_METHOD_REQUIRED",
        400,
        "Informe a forma de pagamento (ou \"unknown\" se não souber)."
      );
    } else if (!(HISTORICAL_METHODS as readonly string[]).includes(m)) {
      err("ERR_HISTORICAL_METHOD_INVALID", 400, "Forma de pagamento inválida.");
    } else {
      method = m;
    }
  }

  if (decision === "historical_courtesy") {
    // Cortesia: data opcional (quando foi concedida); sem data → desconhecida, nunca inventada.
    if (paidAtRaw && paidAtUnknown) {
      err(
        "ERR_HISTORICAL_PAID_AT_REQUIRED",
        400,
        "Informe a data OU marque como desconhecida (não ambos)."
      );
    } else if (paidAtRaw) {
      validatePaidAtDate();
    }
    if (input.amount !== undefined && input.amount !== null && input.amount !== "") {
      const c = toCents(input.amount);
      if (c === null || invoiceCents === null || c < invoiceCents) {
        err("ERR_PAYMENT_AMOUNT_INSUFFICIENT", 400, "A cortesia cobre o valor integral da fatura.");
      } else if (c > invoiceCents) {
        err("ERR_PAYMENT_AMOUNT_EXCEEDS", 400, "A cortesia cobre exatamente o valor da fatura.");
      }
    }
    amount = invoiceAmount;
    const m = str(input.method);
    if (m && !(HISTORICAL_METHODS as readonly string[]).includes(m)) {
      err("ERR_HISTORICAL_METHOD_INVALID", 400, "Forma de pagamento inválida.");
    }
    method = m && (HISTORICAL_METHODS as readonly string[]).includes(m) ? m : "unknown";
  }

  if (terminal && signals.efiCharge) {
    if (!efiChargeAcknowledged) {
      err(
        "ERR_HISTORICAL_EFI_ACK_REQUIRED",
        400,
        "Esta fatura tem cobrança Efí gerada. Verifique na Efí que ela não foi paga e confirme (efiChargeAcknowledged)."
      );
    }
    alerts.push({
      code: "EFI_CHARGE_EXISTS",
      message:
        "Há cobrança Efí gerada para esta fatura. Ela NÃO é cancelada na Efí; se o cliente pagar depois, o pagamento cairá em conciliação."
    });
  }

  const effectivePaidAtUnknown =
    (decision === "historical_payment" || decision === "historical_courtesy") && !paidAt;

  if (decision === "historical_payment" && paidAtUnknown) {
    alerts.push({
      code: "PAID_AT_UNKNOWN",
      message:
        "Pagamento sem data: entra nos totais recebidos, mas aparece como \"data desconhecida\" (fora de qualquer competência)."
    });
  }
  if (decision === "historical_payment" && method === "unknown") {
    alerts.push({ code: "METHOD_UNKNOWN", message: "Forma de pagamento registrada como desconhecida." });
  }
  if (decision === "historical_payment" && (signals.adminRenewalsAfterDue > 0 || signals.coveredByCurrentDueDate)) {
    alerts.push({
      code: "SIGNALS_NOT_PROOF",
      message:
        "Renovação administrativa / vencimento atual são apenas indícios; confirme o recebimento na fonte informada."
    });
  }
  if (ctx.keptPendingCount > 0 && terminal) {
    alerts.push({
      code: "PREVIOUSLY_KEPT_PENDING",
      message: `Esta fatura foi mantida pendente ${ctx.keptPendingCount} vez(es) anteriormente.`
    });
  }
  alerts.push({
    code: "NO_RENEWAL",
    message: "A regularização histórica não altera o vencimento nem renova a assinatura."
  });

  let invoiceStatusAfter = String(invoice.status || "open");
  if (decision === "historical_payment" || decision === "historical_courtesy") {
    invoiceStatusAfter = "paid";
  } else if (decision === "improper_cancel") {
    invoiceStatusAfter = "cancelled";
  }

  const hasPayment =
    decision === "historical_payment" || decision === "historical_courtesy";

  return {
    valid: errors.length === 0,
    errors,
    alerts,
    decision,
    revenueEffect: decision === "historical_payment" ? "revenue" : "no_revenue",
    invoiceStatusAfter,
    willRenew: false,
    payment: hasPayment
      ? {
          amount: (decision === "historical_payment" ? amount : invoiceAmount) ?? 0,
          paidAt,
          paidAtUnknown: effectivePaidAtUnknown
        }
      : null,
    normalized: {
      note,
      confirmationSource,
      paidAt,
      paidAtUnknown: effectivePaidAtUnknown,
      amount,
      method,
      efiChargeAcknowledged
    }
  };
}

/** Carrega o contexto da fatura (dentro da transação informada). */
async function loadContext(params: {
  companyId: number;
  invoiceId: number;
  transaction: Transaction;
  lock: boolean;
}): Promise<HistoricalReviewContext> {
  const { companyId, invoiceId, transaction: t } = params;
  const invoice = await Invoices.findOne({
    where: { id: invoiceId, companyId },
    transaction: t,
    ...(params.lock ? { lock: t.LOCK.UPDATE } : {})
  });
  if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404, "Fatura não encontrada.");

  const company = await Company.findByPk(companyId, {
    attributes: ["id", "name", "timezone", "dueDate", "recurrence"],
    transaction: t
  });
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const payments = await SaaSPayment.findAll({
    where: { invoiceId: invoice.id },
    attributes: ["id", "source"],
    transaction: t
  });
  const reviews = await SaaSInvoiceHistoricalReview.findAll({
    where: { invoiceId: invoice.id, companyId },
    attributes: ["id", "decision"],
    transaction: t
  });
  const pendingRecon = await SaaSReconciliationItem.count({
    where: { invoiceId: invoice.id, status: { [Op.ne]: "resolved" } },
    transaction: t
  });
  const renewLogs = await CompanyLog.findAll({
    where: { companyId, action: "renew" },
    attributes: ["createdAt"],
    transaction: t
  });

  const tz = resolveSaasTimezone(company.timezone);
  return {
    invoice,
    company,
    payments: payments as any,
    terminalReview: (reviews.find(r => isTerminalDecision(r.decision)) as any) || null,
    keptPendingCount: reviews.filter(r => r.decision === "keep_pending").length,
    signals: computeSignals({
      invoice,
      company,
      renewLogDates: renewLogs.map(l => l.createdAt),
      pendingReconciliation: pendingRecon > 0
    }),
    referenceDate: getHistoricalReferenceDate(),
    today: todayDomainDate(tz)
  };
}

function publicPlan(plan: HistoricalReviewPlan) {
  return {
    valid: plan.valid,
    errors: plan.errors.map(e => ({ code: e.code, message: e.message })),
    alerts: plan.alerts,
    decision: plan.decision,
    revenueEffect: plan.revenueEffect,
    invoiceStatusAfter: plan.invoiceStatusAfter,
    willRenew: false as const,
    payment: plan.payment
  };
}

/** Prévia: mesma função da execução, sem escrita. */
export async function previewHistoricalReview(params: {
  companyId: number;
  invoiceId: number;
  input: HistoricalReviewInput;
}) {
  return sequelize.transaction(async t => {
    const ctx = await loadContext({ ...params, transaction: t, lock: false });
    return publicPlan(evaluateHistoricalReview(ctx, params.input));
  });
}

function isTerminalUniqueViolation(err: any): boolean {
  if (err?.name !== "SequelizeUniqueConstraintError") return false;
  const constraint = String(err?.parent?.constraint || err?.original?.constraint || "");
  return !constraint || constraint === TERMINAL_UNIQUE_INDEX;
}

/** Execução: lock FOR UPDATE da fatura, revalidação completa e efeitos exatos do C5. Sem renovação. */
export async function applyHistoricalReview(params: {
  companyId: number;
  invoiceId: number;
  actorUserId: number;
  input: HistoricalReviewInput;
}) {
  try {
    return await sequelize.transaction(async t => {
      const ctx = await loadContext({ ...params, transaction: t, lock: true });
      const plan = evaluateHistoricalReview(ctx, params.input);
      if (!plan.valid || !plan.decision) {
        const first = plan.errors[0];
        throw new AppError(first.code, first.status, first.message);
      }

      const decision = plan.decision;
      const n = plan.normalized;
      const invoice = ctx.invoice as Invoices;
      const invoiceStatusBefore = invoice.status;
      const paidAtDate = n.paidAt ? new Date(`${n.paidAt}T12:00:00.000Z`) : null;
      const efi = {
        externalTxid: invoice.externalTxid ?? null,
        externalChargeId: invoice.externalChargeId ?? null,
        efiChargeAcknowledged: n.efiChargeAcknowledged
      };
      let payment: SaaSPayment | null = null;

      if (decision === "historical_payment" || decision === "historical_courtesy") {
        const isPayment = decision === "historical_payment";
        payment = await SaaSPayment.create(
          {
            companyId: invoice.companyId,
            invoiceId: invoice.id,
            amount: isPayment ? n.amount : Number(invoice.value),
            method: n.method,
            source: decision,
            countsAsRevenue: isPayment,
            paidAt: paidAtDate,
            recordedByUserId: params.actorUserId,
            reason: n.note,
            // txid/chargeId NÃO são copiados (unicidade/idempotência do webhook): ficam no metadata.
            externalTxid: null,
            externalChargeId: null,
            gatewayProvider: null,
            gatewaySyncStatus: "none",
            gatewaySyncError: null,
            metadata: {
              kind: decision,
              historical: true,
              paidAtUnknown: n.paidAtUnknown,
              confirmationSource: n.confirmationSource,
              ...efi
            }
          } as any,
          { transaction: t }
        );

        await invoice.update(
          { status: "paid", paidAt: paidAtDate, paymentSource: decision },
          { transaction: t }
        );
      } else if (decision === "improper_cancel") {
        await cancelLockedInvoice({
          invoice,
          companyId: params.companyId,
          actorUserId: params.actorUserId,
          reason: n.note,
          transaction: t,
          eventType: LEDGER_EVENT.improper_cancel,
          extraPayload: {
            historical: true,
            decision,
            note: n.note,
            confirmationSource: n.confirmationSource,
            efiChargeAcknowledged: n.efiChargeAcknowledged,
            signals: ctx.signals
          }
        });
      }

      const review = await SaaSInvoiceHistoricalReview.create(
        {
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          decision,
          note: n.note,
          confirmationSource: n.confirmationSource,
          paidAt: paidAtDate,
          paidAtUnknown: n.paidAtUnknown,
          amount: payment ? payment.amount : null,
          method: payment ? n.method : null,
          paymentId: payment ? payment.id : null,
          actorUserId: params.actorUserId,
          metadata: {
            invoiceStatusBefore,
            signals: ctx.signals,
            referenceDate: ctx.referenceDate,
            alerts: plan.alerts.map(a => a.code),
            ...efi
          }
        } as any,
        { transaction: t }
      );

      if (decision !== "improper_cancel") {
        await recordFinancialEvent({
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          paymentId: payment ? payment.id : null,
          eventType: LEDGER_EVENT[decision],
          actorUserId: params.actorUserId,
          idempotencyKey: isTerminalDecision(decision) ? `historical:${invoice.id}` : null,
          payload: {
            historical: true,
            decision,
            reviewId: review.id,
            note: n.note,
            confirmationSource: n.confirmationSource,
            amount: payment ? Number(payment.amount) : null,
            method: payment ? n.method : null,
            paidAt: n.paidAt,
            paidAtUnknown: n.paidAtUnknown,
            countsAsRevenue: decision === "historical_payment",
            invoiceStatusBefore,
            invoiceStatusAfter: plan.invoiceStatusAfter,
            renewed: false,
            signals: ctx.signals,
            ...efi
          },
          transaction: t
        });
      }

      await invoice.reload({ transaction: t });
      return { review, invoice, payment };
    });
  } catch (err: any) {
    if (isTerminalUniqueViolation(err)) {
      throw new AppError(
        "ERR_HISTORICAL_ALREADY_REVIEWED",
        409,
        "Esta fatura já foi regularizada."
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// Fila / contagem
// ---------------------------------------------------------------------------------------------

const NO_PAYMENT_SQL = literal(
  `NOT EXISTS (SELECT 1 FROM "SaaSPayments" AS "p" WHERE "p"."invoiceId" = "Invoices"."id")`
);
const NO_TERMINAL_REVIEW_SQL = literal(
  `NOT EXISTS (SELECT 1 FROM "SaaSInvoiceHistoricalReviews" AS "r" WHERE "r"."invoiceId" = "Invoices"."id" AND "r"."decision" <> 'keep_pending')`
);
const OPEN_STATUS_SQL = literal(`LOWER("Invoices"."status") NOT IN ('paid', 'cancelled')`);

/** Faturas em aberto, sem pagamento e sem decisão terminal, classificadas como históricas (fuso da empresa). */
async function loadUnresolvedCandidates(companyId?: number) {
  const where: any = { [Op.and]: [OPEN_STATUS_SQL, NO_PAYMENT_SQL, NO_TERMINAL_REVIEW_SQL] };
  if (companyId) where.companyId = companyId;
  const rows = await Invoices.findAll({
    where,
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "name", "timezone", "dueDate", "recurrence"]
      }
    ],
    order: [["dueDate", "ASC"], ["id", "ASC"]]
  });
  const referenceDate = getHistoricalReferenceDate();
  return rows.filter(inv =>
    isHistoricalCandidate(inv as any, (inv as any).company, { referenceDate })
  );
}

/** Quantidade de faturas históricas ainda não regularizadas (pendentes + mantidas pendentes). */
export async function countHistoricalReviewPending(companyId?: number): Promise<number> {
  return (await loadUnresolvedCandidates(companyId)).length;
}

export async function getHistoricalReviewSummary(companyId?: number) {
  const candidates = await loadUnresolvedCandidates(companyId);
  const kept = await keptPendingInvoiceIds(candidates.map(c => c.id));
  const byCompany: Record<string, number> = {};
  for (const c of candidates) {
    byCompany[c.companyId] = (byCompany[c.companyId] || 0) + 1;
  }
  return {
    total: candidates.length,
    pending: candidates.filter(c => !kept.has(c.id)).length,
    keptPending: candidates.filter(c => kept.has(c.id)).length,
    byCompany
  };
}

async function keptPendingInvoiceIds(invoiceIds: number[]): Promise<Set<number>> {
  if (!invoiceIds.length) return new Set();
  const rows = await SaaSInvoiceHistoricalReview.findAll({
    where: { invoiceId: { [Op.in]: invoiceIds }, decision: "keep_pending" },
    attributes: ["invoiceId"]
  });
  return new Set(rows.map(r => Number(r.invoiceId)));
}

/** unresolved = pendentes + mantidas pendentes (o mesmo universo dos contadores de summary). */
export type HistoricalQueueState =
  | "pending"
  | "kept_pending"
  | "unresolved"
  | "resolved"
  | "all";

export async function listHistoricalReviewQueue(opts: {
  companyId?: number;
  state?: string;
  page?: number;
  limit?: number;
}) {
  const state: HistoricalQueueState = (
    ["pending", "kept_pending", "unresolved", "resolved", "all"] as string[]
  ).includes(String(opts.state))
    ? (opts.state as HistoricalQueueState)
    : "pending";
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 20));

  type Entry = { invoice: any; company: any; resolved: boolean };
  let entries: Entry[] = [];

  if (state !== "resolved") {
    const candidates = await loadUnresolvedCandidates(opts.companyId);
    const kept = await keptPendingInvoiceIds(candidates.map(c => c.id));
    for (const c of candidates) {
      const isKept = kept.has(c.id);
      if (state === "pending" && isKept) continue;
      if (state === "kept_pending" && !isKept) continue;
      entries.push({ invoice: c, company: (c as any).company, resolved: false });
    }
  }

  if (state === "resolved" || state === "all") {
    const where: any = { decision: { [Op.ne]: "keep_pending" } };
    if (opts.companyId) where.companyId = opts.companyId;
    const terminal = await SaaSInvoiceHistoricalReview.findAll({
      where,
      include: [
        {
          model: Invoices,
          as: "invoice",
          include: [
            {
              model: Company,
              as: "company",
              attributes: ["id", "name", "timezone", "dueDate", "recurrence"]
            }
          ]
        }
      ],
      order: [["createdAt", "DESC"], ["id", "DESC"]]
    });
    entries = entries.concat(
      terminal
        .filter(r => (r as any).invoice)
        .map(r => ({
          invoice: (r as any).invoice,
          company: (r as any).invoice.company,
          resolved: true
        }))
    );
  }

  const count = entries.length;
  const pageEntries = entries.slice((page - 1) * limit, page * limit);
  const invoiceIds = pageEntries.map(e => Number(e.invoice.id));
  const companyIds = Array.from(new Set(pageEntries.map(e => Number(e.invoice.companyId))));

  const [reviews, recon, logs] = invoiceIds.length
    ? await Promise.all([
        SaaSInvoiceHistoricalReview.findAll({
          where: { invoiceId: { [Op.in]: invoiceIds } },
          include: [{ model: User, as: "actor", attributes: ["id", "name"] }],
          order: [["createdAt", "DESC"], ["id", "DESC"]]
        }),
        SaaSReconciliationItem.findAll({
          where: { invoiceId: { [Op.in]: invoiceIds }, status: { [Op.ne]: "resolved" } },
          attributes: ["invoiceId"]
        }),
        CompanyLog.findAll({
          where: { companyId: { [Op.in]: companyIds }, action: "renew" },
          attributes: ["companyId", "createdAt"]
        })
      ])
    : [[], [], []];

  const latestReview = new Map<number, any>();
  for (const r of reviews as any[]) {
    const id = Number(r.invoiceId);
    const current = latestReview.get(id);
    // Terminal tem prioridade; senão a mais recente (lista já vem em ordem decrescente).
    if (!current || (isTerminalDecision(r.decision) && !isTerminalDecision(current.decision))) {
      latestReview.set(id, r);
    }
  }
  const reconSet = new Set((recon as any[]).map(r => Number(r.invoiceId)));
  const logsByCompany = new Map<number, Date[]>();
  for (const l of logs as any[]) {
    const id = Number(l.companyId);
    if (!logsByCompany.has(id)) logsByCompany.set(id, []);
    logsByCompany.get(id)!.push(l.createdAt);
  }

  const items = pageEntries.map(e => {
    const inv = e.invoice;
    const signals = computeSignals({
      invoice: inv,
      company: e.company,
      renewLogDates: logsByCompany.get(Number(inv.companyId)) || [],
      pendingReconciliation: reconSet.has(Number(inv.id))
    });
    const review = latestReview.get(Number(inv.id)) || null;
    let blockedReason: string | null = null;
    if (e.resolved) {
      blockedReason = "Fatura já regularizada.";
    } else if (
      signals.pendingReconciliation ||
      String(inv.gatewayStatus || "").toUpperCase() === "CONCLUIDA"
    ) {
      blockedReason =
        "A Efí indica pagamento ou há conciliação pendente: resolva pela conciliação.";
    }
    const json = typeof inv.toJSON === "function" ? inv.toJSON() : { ...inv };
    delete json.company;
    const tz = resolveSaasTimezone(e.company?.timezone);
    return {
      invoice: { ...json, dueDateDomain: toDomainDate(json.dueDate, tz) },
      company: { id: e.company?.id ?? inv.companyId, name: e.company?.name ?? null },
      signals,
      review: review
        ? {
            decision: review.decision,
            note: review.note,
            createdAt: review.createdAt,
            actor: review.actor ? { id: review.actor.id, name: review.actor.name } : null
          }
        : null,
      blockedReason
    };
  });

  return { items, count, hasMore: count > page * limit, page, limit, state };
}
