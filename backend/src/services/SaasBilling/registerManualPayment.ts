import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Invoices from "../../models/Invoices";
import Company from "../../models/Company";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import SaaSSubscriptionRenewal from "../../models/SaaSSubscriptionRenewal";
import SaaSInvoiceHistoricalReview from "../../models/SaaSInvoiceHistoricalReview";
import sequelize from "../../database";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import {
  applySubscriptionRenewal,
  ApplySubscriptionRenewalResult,
  loadLastBlockAction,
  planSubscriptionRenewal,
  RenewalSkippedReason,
  runRenewalSideEffects
} from "./applySubscriptionRenewal";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { settleEfiCobrancasCharge } from "./efiCobrancasClient";
import { logger } from "../../utils/logger";
import { toDomainDate } from "../../helpers/saasDueDate";
import { BlockKind } from "./billingEvaluation";
import { isHistoricalCandidate } from "./HistoricalReviewService";

export type ManualPaymentKind = "paid_offline" | "courtesy";

export const MANUAL_PAYMENT_METHODS = [
  "pix",
  "transfer",
  "boleto",
  "credit_card",
  "debit_card",
  "cash",
  "other"
] as const;

export type RegisterManualPaymentInput = {
  invoiceId: number;
  companyId: number;
  actorUserId: number;
  kind: ManualPaymentKind;
  amount: number;
  method: string;
  paidAt: Date;
  reason: string;
  renewSubscription?: boolean;
  /**
   * Vencimento da empresa exibido na prévia (YYYY-MM-DD ou null). Se informado e diferente do
   * atual (revalidado sob lock da empresa) → 409 ERR_PAYMENT_STATE_CHANGED. `undefined` = não valida.
   */
  expectedCurrentDueDate?: string | null;
};

export type ManualPaymentIssue = {
  code: string;
  message: string;
  statusCode: number;
};

const DOMAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validações do corpo (independentes da fatura) — mesmas na prévia e na execução. */
export function validateManualPaymentInput(input: {
  reason?: unknown;
  amount?: unknown;
  paidAt?: unknown;
  expectedCurrentDueDate?: unknown;
}): ManualPaymentIssue[] {
  const issues: ManualPaymentIssue[] = [];
  if (!input.reason || !String(input.reason).trim()) {
    issues.push({
      code: "ERR_MANUAL_PAYMENT_REASON_REQUIRED",
      message: "Informe o motivo/observação do pagamento.",
      statusCode: 400
    });
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    issues.push({
      code: "ERR_PAYMENT_AMOUNT_INVALID",
      message: "Informe um valor recebido válido.",
      statusCode: 400
    });
  }
  if (!(input.paidAt instanceof Date) || Number.isNaN(input.paidAt.getTime())) {
    issues.push({
      code: "ERR_PAYMENT_DATE_INVALID",
      message: "Informe a data do pagamento.",
      statusCode: 400
    });
  }
  if (
    input.expectedCurrentDueDate !== undefined &&
    input.expectedCurrentDueDate !== null &&
    !DOMAIN_DATE_RE.test(String(input.expectedCurrentDueDate))
  ) {
    issues.push({
      code: "ERR_INVALID_DUE_DATE",
      message: "expectedCurrentDueDate deve estar no formato AAAA-MM-DD.",
      statusCode: 400
    });
  }
  return issues;
}

/** Validações contra a fatura (status e valor exato, D7) — mesmas na prévia e na execução. */
export function validateManualPaymentAgainstInvoice(
  invoice: { status: string; value: number | string },
  input: { kind: ManualPaymentKind; amount: number }
): ManualPaymentIssue[] {
  const status = String(invoice.status).toLowerCase();
  if (status === "paid" || status === "cancelled") {
    return [
      {
        code: "ERR_INVOICE_NOT_OPEN",
        statusCode: 409,
        message:
          status === "paid"
            ? "Esta fatura já está paga. Atualize a página."
            : "Esta fatura está cancelada e não pode receber pagamento."
      }
    ];
  }
  if (input.kind === "courtesy") return [];
  // Pagamento parcial não é suportado: só quita com o valor exato da fatura.
  const dueCents = Math.round(Number(invoice.value) * 100);
  const paidCents = Math.round(Number(input.amount) * 100);
  if (paidCents < dueCents) {
    return [
      {
        code: "ERR_PAYMENT_AMOUNT_INSUFFICIENT",
        statusCode: 400,
        message:
          "Valor recebido menor que o valor da fatura. Pagamento parcial não é suportado; se houve desconto acordado, edite o valor da fatura antes de registrar o pagamento."
      }
    ];
  }
  if (paidCents > dueCents) {
    return [
      {
        code: "ERR_PAYMENT_AMOUNT_EXCEEDS",
        statusCode: 400,
        message:
          "Valor recebido maior que o valor da fatura. Ajuste o valor da fatura ou registre o valor exato."
      }
    ];
  }
  return [];
}

function throwIssue(issue: ManualPaymentIssue): never {
  throw new AppError(issue.code, issue.statusCode, issue.message);
}

export const PAYMENT_STATE_CHANGED_MESSAGE =
  "O vencimento desta empresa mudou desde a prévia. Recarregue a página e confira a prévia novamente.";

/**
 * Baixa manual Super Admin.
 * Cortesia: countsAsRevenue=false.
 * Pix: nunca simula CONCLUIDA; se houver charge Cobranças, tenta settle se flag ON.
 */
export type RegisterManualPaymentResult = {
  payment: SaaSPayment;
  invoice: Invoices;
  gatewaySyncStatus: string;
  renewed: boolean;
  renewalSkippedReason: RenewalSkippedReason | "disabled";
  company: { id: number; dueDate: string | null; status: boolean } | null;
};

export async function registerManualPayment(
  input: RegisterManualPaymentInput
): Promise<RegisterManualPaymentResult> {
  const inputIssues = validateManualPaymentInput(input);
  if (inputIssues.length) throwIssue(inputIssues[0]);

  let renewResult: ApplySubscriptionRenewalResult | null = null;

  const result = await sequelize.transaction(async t => {
    const invoice = await Invoices.findOne({
      where: { id: input.invoiceId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

    const isCourtesy = input.kind === "courtesy";
    const invoiceIssues = validateManualPaymentAgainstInvoice(invoice, input);
    if (invoiceIssues.length) throwIssue(invoiceIssues[0]);

    if (input.expectedCurrentDueDate !== undefined) {
      // Revalida a prévia sob lock da empresa (ordem de lock: fatura → empresa, igual ao gateway).
      const company = await Company.findByPk(invoice.companyId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);
      const current = toDomainDate(company.dueDate, company.timezone);
      const expected =
        toDomainDate(input.expectedCurrentDueDate, company.timezone) || null;
      if (expected !== current) {
        throw new AppError(
          "ERR_PAYMENT_STATE_CHANGED",
          409,
          PAYMENT_STATE_CHANGED_MESSAGE
        );
      }
    }

    const countsAsRevenue = !isCourtesy;
    const paymentSource = isCourtesy ? "courtesy" : "paid_offline";

    let gatewaySyncStatus = "none";
    let gatewaySyncError: string | null = null;

    // Tentativa de settle apenas para API Cobranças (boleto/cartão), nunca Pix
    const canSettle =
      saasBillingFlags.cobrancasSettleEnabled() &&
      !!invoice.externalChargeId &&
      (invoice.gatewayProvider === "efi_cobrancas" ||
        String(invoice.gatewayProvider || "").includes("cobrancas"));

    if (canSettle && !isCourtesy) {
      try {
        await settleEfiCobrancasCharge(String(invoice.externalChargeId));
        gatewaySyncStatus = "synced";
      } catch (err: any) {
        gatewaySyncStatus = "failed";
        gatewaySyncError = err?.message || String(err);
        logger.warn(
          { err, invoiceId: invoice.id },
          "[SaasBilling] efi_settle_failed"
        );
      }
    } else if (
      invoice.externalTxid &&
      (invoice.gatewayProvider === "efi" ||
        invoice.gatewayProvider === "gerencianet")
    ) {
      // Pix: baixa manual externa não suportada oficialmente
      gatewaySyncStatus = "unsupported";
      gatewaySyncError =
        "Pix não possui operação oficial de marcar como pago manualmente. Baixa apenas local; status externo preservado.";
    } else if (invoice.externalChargeId && !canSettle) {
      gatewaySyncStatus = "pending";
      gatewaySyncError =
        "Settle Cobranças desabilitado (EFI_COBRANCAS_SETTLE_ENABLED). Baixa local registrada; conciliar externamente.";
    }

    const payment = await SaaSPayment.create(
      {
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        amount: isCourtesy ? Number(invoice.value) : input.amount,
        method: input.method,
        source: paymentSource,
        countsAsRevenue,
        paidAt: input.paidAt,
        recordedByUserId: input.actorUserId,
        reason: input.reason.trim(),
        externalTxid: invoice.externalTxid,
        externalChargeId: invoice.externalChargeId,
        gatewayProvider: invoice.gatewayProvider,
        gatewaySyncStatus,
        gatewaySyncError,
        metadata: { kind: input.kind }
      },
      { transaction: t }
    );

    await invoice.update(
      {
        status: "paid",
        paidAt: input.paidAt,
        paymentSource,
        gatewaySyncStatus,
        gatewaySyncError,
        legacyUnknown: false
      },
      { transaction: t }
    );

    await recordFinancialEvent({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      eventType: isCourtesy ? "courtesy_granted" : "manual_payment_recorded",
      actorUserId: input.actorUserId,
      idempotencyKey: `manual:${invoice.id}:${payment.id}`,
      payload: {
        kind: input.kind,
        amount: input.amount,
        method: input.method,
        reason: input.reason,
        gatewaySyncStatus,
        countsAsRevenue
      },
      transaction: t
    });

    if (
      gatewaySyncStatus === "failed" ||
      gatewaySyncStatus === "unsupported" ||
      gatewaySyncStatus === "pending"
    ) {
      await SaaSReconciliationItem.create(
        {
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          paymentId: payment.id,
          kind:
            gatewaySyncStatus === "unsupported"
              ? "manual_pix_no_settle"
              : "manual_settle_divergence",
          status: "pending",
          message: gatewaySyncError,
          retryCount: 0,
          lastError: gatewaySyncError,
          metadata: {
            gatewaySyncStatus,
            externalTxid: invoice.externalTxid,
            externalChargeId: invoice.externalChargeId
          }
        },
        { transaction: t }
      );
    }

    const shouldRenew =
      input.renewSubscription !== false &&
      (isCourtesy || input.kind === "paid_offline");

    let renewed = false;
    let renewalSkippedReason: RenewalSkippedReason | "disabled" = shouldRenew
      ? null
      : "disabled";
    if (shouldRenew) {
      // Uma renovação por fatura, qualquer que seja a origem do pagamento (manual ou gateway).
      renewResult = await applySubscriptionRenewal({
        companyId: invoice.companyId,
        reason: isCourtesy ? "courtesy" : "payment_confirmed",
        actorUserId: input.actorUserId,
        invoiceId: invoice.id,
        paymentId: payment.id,
        idempotencyKey: `renew-invoice:${invoice.id}`,
        coversInvoiceDueDate: invoice.dueDate,
        note: input.reason.trim(),
        transaction: t
      });
      renewed = !!renewResult.renewal && !renewResult.alreadyApplied;
      renewalSkippedReason = renewResult.skippedReason;
    }

    await invoice.reload({ transaction: t });
    const company = renewResult?.company;
    return {
      payment,
      invoice,
      gatewaySyncStatus,
      renewed,
      renewalSkippedReason,
      company: company
        ? {
            id: company.id,
            dueDate: toDomainDate(company.dueDate, company.timezone),
            status: company.status
          }
        : null
    };
  });

  if (renewResult) {
    await runRenewalSideEffects(
      {
        reason: input.kind === "courtesy" ? "courtesy" : "payment_confirmed",
        actorUserId: input.actorUserId,
        note: input.reason.trim()
      },
      renewResult
    );
  }

  return result;
}

/* ------------------------------------------------------------------------------------------------
 * Prévia da baixa manual (C6) — SOMENTE LEITURA. Mesmas validações da execução
 * (validateManualPaymentInput/validateManualPaymentAgainstInvoice) e mesmo planejador de renovação
 * (planSubscriptionRenewal). A execução revalida tudo sob lock (expectedCurrentDueDate → 409).
 * ---------------------------------------------------------------------------------------------- */

export type ManualPaymentPreviewInput = {
  companyId: number;
  invoiceId: number;
  kind?: unknown;
  amount?: unknown;
  method?: unknown;
  paidAt?: unknown;
  reason?: unknown;
  renewSubscription?: unknown;
  expectedCurrentDueDate?: unknown;
};

export type PreviewMessage = { code: string; message: string };

export type ManualPaymentPreview = {
  valid: boolean;
  errors: PreviewMessage[];
  alerts: PreviewMessage[];
  company: { id: number; name: string };
  invoice: {
    id: number;
    value: number;
    dueDate: string | null;
    status: string;
    detail: string | null;
  };
  kind: string | null;
  amount: number | null;
  method: string | null;
  previousDueDate: string | null;
  newDueDate: string | null;
  willRenew: boolean;
  renewalSkippedReason: null | "period_already_covered" | "disabled";
  revenueEffect: "revenue" | "no_revenue";
  invoiceStatusAfter: "paid";
  willUnblock: boolean;
  blockKind: BlockKind;
  /** Vencimento atual: enviar de volta no POST manual-payment (409 se mudar). */
  expectedCurrentDueDate: string | null;
};

const KINDS: ManualPaymentKind[] = ["paid_offline", "courtesy"];

function parsePaidAt(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (raw instanceof Date) return raw;
  const s = String(raw);
  // Mesmo tratamento do controller de execução: "YYYY-MM-DD" → meio-dia UTC.
  return DOMAIN_DATE_RE.test(s) ? new Date(`${s}T12:00:00.000Z`) : new Date(s);
}

export async function previewManualPayment(
  input: ManualPaymentPreviewInput
): Promise<ManualPaymentPreview> {
  // Isolamento: a fatura precisa pertencer à empresa do path.
  const invoice = await Invoices.findOne({
    where: { id: input.invoiceId, companyId: input.companyId }
  });
  if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);
  const company = await Company.findByPk(input.companyId);
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const errors: PreviewMessage[] = [];
  const alerts: PreviewMessage[] = [];
  const pushIssue = (i: ManualPaymentIssue) =>
    errors.push({ code: i.code, message: i.message });

  // Regras do controller (Yup) da execução, reportadas como erros da prévia.
  const kind = KINDS.includes(input.kind as ManualPaymentKind)
    ? (input.kind as ManualPaymentKind)
    : null;
  if (!kind) {
    errors.push({
      code: "ERR_PAYMENT_KIND_INVALID",
      message: "Tipo inválido: use paid_offline (pagamento) ou courtesy (cortesia)."
    });
  }
  const method =
    input.method !== undefined && input.method !== null && String(input.method).trim()
      ? String(input.method)
      : null;
  if (!method) {
    errors.push({ code: "ERR_PAYMENT_METHOD_REQUIRED", message: "Informe a forma de pagamento." });
  }
  const reasonText = String(input.reason ?? "").trim();
  if (reasonText.length > 0 && reasonText.length < 3) {
    errors.push({
      code: "ERR_MANUAL_PAYMENT_REASON_REQUIRED",
      message: "O motivo/observação deve ter ao menos 3 caracteres."
    });
  }
  const paidAt = parsePaidAt(input.paidAt);
  validateManualPaymentInput({
    reason: input.reason,
    amount: input.amount,
    paidAt,
    expectedCurrentDueDate: input.expectedCurrentDueDate
  }).forEach(pushIssue);

  const amountNum = Number(input.amount);
  const tz = company.timezone;
  const invoiceValue = Number(invoice.value);
  const isCourtesy = kind === "courtesy";

  validateManualPaymentAgainstInvoice(invoice, {
    kind: kind || "paid_offline",
    amount: amountNum
  }).forEach(pushIssue);

  const invoiceStatus = String(invoice.status).toLowerCase();
  if (invoiceStatus === "paid" || invoiceStatus === "cancelled") {
    alerts.push({
      code: "INVOICE_NOT_OPEN",
      message:
        invoiceStatus === "paid"
          ? "Esta fatura já está paga."
          : "Esta fatura está cancelada."
    });
  }
  if (
    Number.isFinite(amountNum) &&
    Math.round(amountNum * 100) !== Math.round(invoiceValue * 100)
  ) {
    alerts.push({
      code: "AMOUNT_MISMATCH",
      message: isCourtesy
        ? `Cortesia registra o valor da fatura (${invoiceValue.toFixed(2)}), não o valor informado, e não conta como receita.`
        : `Valor informado (${amountNum.toFixed(2)}) difere do valor da fatura (${invoiceValue.toFixed(2)}). Pagamento parcial não é suportado.`
    });
  }

  if (invoice.externalTxid || invoice.externalChargeId) {
    alerts.push({
      code: "EFI_CHARGE_EXISTS",
      message: invoice.externalTxid
        ? "Esta fatura tem cobrança Pix Efí gerada: a baixa é apenas local (a Efí não permite marcar Pix como pago) e um item de conciliação será aberto. Se o cliente também pagar o Pix, haverá pagamento em duplicidade."
        : "Esta fatura tem cobrança Efí (boleto/cartão) gerada: confira na Efí antes de registrar; a baixa pode exigir conciliação."
    });
  }

  // Candidata a regularização histórica (C5): sugerir regularização em vez de pagamento atual.
  const [paymentsCount, terminalReviews] = await Promise.all([
    SaaSPayment.count({ where: { invoiceId: invoice.id, companyId: input.companyId } }),
    SaaSInvoiceHistoricalReview.count({
      where: { invoiceId: invoice.id, decision: { [Op.ne]: "keep_pending" } }
    })
  ]);
  if (
    isHistoricalCandidate(
      {
        status: invoice.status,
        createdAt: invoice.createdAt,
        legacyUnknown: invoice.legacyUnknown,
        cycleKey: invoice.cycleKey,
        paymentsCount,
        hasTerminalReview: terminalReviews > 0
      },
      company
    )
  ) {
    alerts.push({
      code: "HISTORICAL_CANDIDATE",
      message:
        "Fatura anterior à central financeira (candidata à regularização histórica). Se o pagamento é antigo, use \"Regularizar histórico\": a baixa manual registra um pagamento atual e pode renovar a assinatura."
    });
  }

  // Planejamento da renovação — mesma função da execução.
  const renewRequested =
    input.renewSubscription !== false && input.renewSubscription !== "false";
  const lastBlockAction =
    company.status === false ? await loadLastBlockAction(company.id) : null;
  const plan = planSubscriptionRenewal({
    company: company as any,
    reason: isCourtesy ? "courtesy" : "payment_confirmed",
    coversInvoiceDueDate: invoice.dueDate,
    lastBlockAction,
    ...(input.expectedCurrentDueDate !== undefined
      ? { expectedCurrentDueDate: input.expectedCurrentDueDate as string | null }
      : {})
  });

  if (plan.stale && !errors.some(e => e.code === "ERR_INVALID_DUE_DATE")) {
    errors.push({ code: "ERR_PAYMENT_STATE_CHANGED", message: PAYMENT_STATE_CHANGED_MESSAGE });
  }

  let willRenew = false;
  let renewalSkippedReason: ManualPaymentPreview["renewalSkippedReason"] = null;
  if (!renewRequested) {
    renewalSkippedReason = "disabled";
  } else if (plan.action === "period_already_covered") {
    renewalSkippedReason = "period_already_covered";
  } else {
    // Mesma idempotência da execução (renew-invoice:<id>): renovação já aplicada não se repete.
    const already = await SaaSSubscriptionRenewal.findOne({
      where: { idempotencyKey: `renew-invoice:${invoice.id}` },
      attributes: ["id"]
    });
    if (!already) {
      if (plan.error) {
        errors.push({ code: plan.error.code, message: plan.error.message });
      } else {
        willRenew = true;
      }
    }
  }
  if (renewRequested) {
    for (const a of plan.alerts) {
      if (!alerts.some(x => x.code === a.code)) alerts.push(a);
    }
  } else if (plan.blockKind === "manual") {
    alerts.push({
      code: "MANUAL_BLOCK_KEEPS_BLOCKED",
      message: "A empresa está bloqueada manualmente e continuará bloqueada."
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    alerts,
    company: { id: company.id, name: company.name },
    invoice: {
      id: invoice.id,
      value: invoiceValue,
      dueDate: toDomainDate(invoice.dueDate, tz),
      status: invoiceStatus,
      detail: invoice.detail ?? null
    },
    kind,
    amount: isCourtesy ? invoiceValue : Number.isFinite(amountNum) ? amountNum : null,
    method,
    previousDueDate: plan.previousDueDate,
    newDueDate: willRenew ? plan.newDueDate : null,
    willRenew,
    renewalSkippedReason,
    revenueEffect: isCourtesy ? "no_revenue" : "revenue",
    invoiceStatusAfter: "paid",
    willUnblock: willRenew ? plan.willUnblock : false,
    blockKind: plan.blockKind,
    expectedCurrentDueDate: plan.previousDueDate
  };
}
