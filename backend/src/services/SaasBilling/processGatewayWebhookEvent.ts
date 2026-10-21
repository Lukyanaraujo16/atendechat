import crypto from "crypto";
import os from "os";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSPaymentAttempt from "../../models/SaaSPaymentAttempt";
import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import SaaSGatewayWebhookEvent, {
  GatewayWebhookEventStatus
} from "../../models/SaaSGatewayWebhookEvent";
import { getEfiActivationControls } from "../../config/saasBillingFlags";
import { logger } from "../../utils/logger";
import {
  confirmGatewayPayment,
  ConfirmGatewayPaymentResult,
  GATEWAY_ON_CANCELLED_KIND,
  GATEWAY_ON_SETTLED_KIND
} from "./confirmGatewayPayment";
import { getEfiPixChargeGateway, EfiPixCob, EfiPixChargeGateway } from "./efiPixChargeGateway";
import { redactEfiSensitiveText } from "./efiIntegrationStatus";
import { publishGatewayWebhookEvent } from "../../libs/gatewayWebhookQueue";

/**
 * Worker do pipeline `async` (B3.3, RF3.7–RF3.15, R-25…R-29).
 *
 * 1. Claim atômico no banco (`received`/`retry_scheduled` vencido → `processing`): dois
 *    workers nunca processam o mesmo evento; o jobId do Bull não é a garantia (PT-8).
 * 2. Consulta a cobrança na Efí (nunca confia só no payload), valida e chama
 *    `confirmGatewayPayment` (núcleo 8.4, idempotente por txid e por fatura).
 * 3. Grava o resultado terminal só se ainda detém o lock. Crash entre 2 e 3 → lock antigo →
 *    recuperação → reprocessamento → `replay` (sem 2º pagamento nem 2ª renovação).
 * Falha transitória → `retry_scheduled` com backoff; esgotou → `failed_exhausted` + conciliação.
 * Situação financeira que exige decisão humana → `reconciliation` (nunca descartada).
 */

/** Backoff proposto (R-28, PT-11): minutos por tentativa; acima do fim da lista, o último. */
export const GATEWAY_WEBHOOK_BACKOFF_MIN = [1, 5, 15, 60, 360];
export const GATEWAY_WEBHOOK_MAX_ATTEMPTS = 8;
const ATTEMPT_LOG_LIMIT = 20;

export const RECON_KIND = {
  amountMismatch: "gateway_pix_amount_mismatch",
  invoiceNotFound: "gateway_pix_invoice_not_found",
  linkConflict: "gateway_pix_link_conflict",
  refund: "gateway_pix_refund",
  paidAfterRefund: "gateway_pix_paid_after_refund",
  notVerifiable: "gateway_pix_not_verifiable",
  notConcluded: "gateway_pix_charge_not_concluded",
  exhausted: "gateway_webhook_failed_exhausted",
  unlinkedConverted: "gateway_pix_unlinked"
} as const;

export const DEFAULT_WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString("hex")}`;

export type ProcessOutcome =
  | { outcome: "skipped"; reason: "paused" | "not_claimed" }
  | { outcome: GatewayWebhookEventStatus; reason?: string };

type Terminal = {
  status: GatewayWebhookEventStatus;
  reason: string;
  companyId?: number | null;
  invoiceId?: number | null;
  paymentId?: number | null;
  reconciliationItemId?: number | null;
  details?: Record<string, unknown>;
};

/** Situação transitória (rede, Efí 5xx/429, banco, cobrança ainda ATIVA): reagendar. */
class TransientError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message || code);
  }
}

export function backoffMinutes(attempts: number): number {
  const i = Math.max(0, attempts - 1);
  return GATEWAY_WEBHOOK_BACKOFF_MIN[Math.min(i, GATEWAY_WEBHOOK_BACKOFF_MIN.length - 1)];
}

function sanitizeError(err: unknown): string {
  const e = err as any;
  const code = e instanceof AppError ? e.message : e?.code || e?.name || "Error";
  const msg = e instanceof AppError ? e.clientMessage || "" : e?.message || "";
  return redactEfiSensitiveText(`${code}${msg && msg !== code ? `: ${msg}` : ""}`).slice(0, 240);
}

const cents = (v: unknown): number => Math.round(Number(String(v ?? "").replace(",", ".")) * 100);
const sha256 = (v: string): string => crypto.createHash("sha256").update(v).digest("hex");

/** R-25: claim atômico. `null` = outro worker pegou, evento terminado ou ainda não vencido. */
export async function claimGatewayWebhookEvent(
  eventId: number,
  workerId: string
): Promise<SaaSGatewayWebhookEvent | null> {
  const rows = await sequelize.query<{ id: number }>(
    `UPDATE "SaaSGatewayWebhookEvents"
        SET status = 'processing', "lockedBy" = :workerId, "lockedAt" = now(),
            attempts = attempts + 1, "updatedAt" = now()
      WHERE id = :eventId AND status IN ('received','retry_scheduled') AND "nextAttemptAt" <= now()
      RETURNING id`,
    { type: QueryTypes.SELECT, replacements: { eventId, workerId } }
  );
  if (!rows[0]) return null;
  return SaaSGatewayWebhookEvent.findByPk(eventId);
}

/** Conciliação idempotente por `eventKey` (reprocessamento não duplica itens). */
async function openItem(input: {
  event: SaaSGatewayWebhookEvent;
  companyId: number;
  invoiceId?: number | null;
  paymentId?: number | null;
  kind: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  const existing = await SaaSReconciliationItem.findOne({
    where: { kind: input.kind, metadata: { eventKey: input.event.eventKey } } as any
  });
  if (existing) return existing.id;
  const item = await SaaSReconciliationItem.create({
    companyId: input.companyId,
    invoiceId: input.invoiceId ?? null,
    paymentId: input.paymentId ?? null,
    kind: input.kind,
    status: "pending",
    message: input.message,
    retryCount: 0,
    lastError: null,
    metadata: {
      eventKey: input.event.eventKey,
      webhookEventId: input.event.id,
      externalTxid: input.event.txid,
      endToEndId: input.event.endToEndId,
      amount: input.event.amount != null ? Number(input.event.amount) : null,
      ...(input.metadata || {})
    }
  } as any);
  return item.id;
}

function brl(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `R$ ${n.toFixed(2)}` : "valor não informado";
}

/** Grava o resultado só se este worker ainda detém o lock (lock roubado → não sobrescreve). */
async function finalize(
  event: SaaSGatewayWebhookEvent,
  workerId: string,
  fields: Partial<SaaSGatewayWebhookEvent> & { status: GatewayWebhookEventStatus },
  logEntry: Record<string, unknown>
): Promise<boolean> {
  const log = [...(event.attemptLog || []), { at: new Date().toISOString(), worker: workerId, ...logEntry }];
  const [count] = await SaaSGatewayWebhookEvent.update(
    {
      ...fields,
      lockedBy: null,
      lockedAt: null,
      attemptLog: log.slice(-ATTEMPT_LOG_LIMIT)
    } as any,
    { where: { id: event.id, status: "processing", lockedBy: workerId } }
  );
  if (count === 0) {
    logger.warn({ eventId: event.id }, "[gatewayWebhook] lock perdido — resultado não gravado");
  }
  return count > 0;
}

function parseInvoiceIdFromCob(cob: EfiPixCob): number | null {
  const m = /#Fatura:\s*(\d+)/.exec(String(cob.solicitacaoPagador || ""));
  return m ? Number(m[1]) : null;
}

async function processPix(
  event: SaaSGatewayWebhookEvent,
  gateway: EfiPixChargeGateway
): Promise<Terminal> {
  const payload = (event.payload || {}) as Record<string, any>;
  const keyMatches =
    !payload.chaveHash || payload.chaveHash === sha256(gateway.context.pixKey);

  // D-P8: Pix sem txid.
  if (!event.txid) {
    if (payload.txidInvalid) {
      return { status: "invalid_permanent", reason: "txid_invalid_format" };
    }
    if (!keyMatches) return { status: "ignored_not_saas", reason: "other_pix_key" };
    if (payload.tipo) return { status: "ignored_not_saas", reason: "not_a_receipt" };
    return { status: "unlinked", reason: "pix_without_txid" };
  }
  if (!keyMatches) {
    // R-29: cobrança de outra chave.
    return { status: "invalid_permanent", reason: "other_pix_key" };
  }

  const txid = event.txid;
  const attempt = await SaaSPaymentAttempt.findOne({ where: { externalTxid: txid } });
  const chargeSource = (attempt?.payloadSummary as any)?.source ?? "legacy_env";
  const details: Record<string, unknown> = {
    chargeSource,
    currentSource: gateway.context.source,
    configId: gateway.context.configId,
    configFingerprint: gateway.context.configFingerprint,
    efiEnvironment: gateway.context.efiEnvironment,
    attemptId: attempt?.id ?? null
  };
  const attemptCompanyId = attempt?.companyId ?? null;

  let cob: EfiPixCob | null;
  try {
    cob = await gateway.getCharge(txid);
  } catch (err) {
    throw new TransientError("efi_get_failed", sanitizeError(err));
  }
  if (!cob) {
    // R-29 / T-SEC-07: txid inexistente na conta. Nada é aplicado.
    const itemId = attemptCompanyId
      ? await openItem({
          event,
          companyId: attemptCompanyId,
          invoiceId: attempt?.invoiceId,
          kind: RECON_KIND.notVerifiable,
          message: `Notificação Pix não verificável: o txid ${txid} (${brl(
            event.amount
          )}) não existe na conta Efí consultada. Nada foi aplicado; confira na Efí.`,
          metadata: details
        })
      : null;
    return {
      status: "invalid_permanent",
      reason: "txid_not_found_in_account",
      companyId: attemptCompanyId,
      invoiceId: attempt?.invoiceId ?? null,
      reconciliationItemId: itemId,
      details
    };
  }
  const chargeStatus = String(cob.status || "").toUpperCase();
  details.chargeStatus = chargeStatus;
  if (cob.chave && cob.chave !== gateway.context.pixKey) {
    return { status: "invalid_permanent", reason: "charge_other_pix_key", details };
  }
  if (chargeStatus === "ATIVA") {
    throw new TransientError("charge_active", "Cobrança ainda ATIVA na Efí");
  }

  const cobPix = Array.isArray(cob.pix) ? cob.pix : [];
  const pixEntry = cobPix.find(p => p.endToEndId === event.endToEndId) as any;
  if (cobPix.length > 0 && !pixEntry) {
    // e2eId da notificação não pertence à cobrança consultada: payload forjado ou trocado.
    return { status: "invalid_permanent", reason: "e2e_not_in_charge", details };
  }

  // Vínculo: txid local (forte) → `#Fatura:` (conferência e fallback pré-migração, R-6).
  const fromCob = parseInvoiceIdFromCob(cob);
  let invoiceId = attempt?.invoiceId ?? fromCob;
  if (!invoiceId) {
    const byTxid = await Invoices.findOne({ where: { externalTxid: txid } });
    invoiceId = byTxid?.id ?? null;
  }
  details.linkedBy = attempt ? "attempt" : fromCob ? "solicitacaoPagador" : invoiceId ? "invoice_txid" : null;

  if (attempt && fromCob && fromCob !== attempt.invoiceId) {
    const itemId = await openItem({
      event,
      companyId: attempt.companyId,
      invoiceId: attempt.invoiceId,
      kind: RECON_KIND.linkConflict,
      message: `Pix ${txid} (${brl(event.amount)}): a tentativa local aponta a fatura #${attempt.invoiceId}, mas a cobrança na Efí indica #Fatura:${fromCob}. Nada foi aplicado.`,
      metadata: { ...details, invoiceFromCharge: fromCob }
    });
    return {
      status: "reconciliation",
      reason: "link_conflict",
      companyId: attempt.companyId,
      invoiceId: attempt.invoiceId,
      reconciliationItemId: itemId,
      details
    };
  }

  const invoice = invoiceId ? await Invoices.findByPk(invoiceId) : null;
  if (!invoice) {
    const itemId = attemptCompanyId
      ? await openItem({
          event,
          companyId: attemptCompanyId,
          kind: RECON_KIND.invoiceNotFound,
          message: `Pix ${txid} (${brl(event.amount)}) confirmado sem fatura local correspondente${
            invoiceId ? ` (#${invoiceId} inexistente)` : ""
          }. Nada foi aplicado.`,
          metadata: details
        })
      : null;
    // Sem empresa conhecida, o próprio evento é o registro classificado (filtro "conciliação").
    return {
      status: "reconciliation",
      reason: invoiceId ? "invoice_not_found" : "txid_without_link",
      companyId: attemptCompanyId,
      reconciliationItemId: itemId,
      details: { ...details, invoiceIdHint: invoiceId }
    };
  }
  if (attempt && attempt.companyId !== invoice.companyId) {
    const itemId = await openItem({
      event,
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      kind: RECON_KIND.linkConflict,
      message: `Pix ${txid}: a tentativa local é da empresa #${attempt.companyId}, mas a fatura #${invoice.id} é da empresa #${invoice.companyId}. Nada foi aplicado.`,
      metadata: details
    });
    return {
      status: "reconciliation",
      reason: "company_conflict",
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      reconciliationItemId: itemId,
      details
    };
  }
  const base = { companyId: invoice.companyId, invoiceId: invoice.id, details };

  if (chargeStatus !== "CONCLUIDA") {
    const itemId = await openItem({
      event,
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      kind: RECON_KIND.notConcluded,
      message: `Notificação Pix para o txid ${txid}, mas a cobrança está ${chargeStatus || "sem status"} na Efí. Nada foi aplicado; confira na Efí.`,
      metadata: details
    });
    return { ...base, status: "reconciliation", reason: "charge_not_concluded", reconciliationItemId: itemId };
  }

  const paidAmount = cob.valor?.original ?? pixEntry?.valor ?? event.amount;
  const alreadyPaidByTxid = await SaaSPayment.findOne({ where: { externalTxid: txid } });

  // SF-3: Pix com devolução registrada (no payload, na Efí ou em evento anterior).
  if (!alreadyPaidByTxid) {
    const refundInCharge = Array.isArray(pixEntry?.devolucoes) && pixEntry.devolucoes.length > 0;
    const refundInPayload = Array.isArray(payload.devolucoes) && payload.devolucoes.length > 0;
    const refundEvent = await SaaSGatewayWebhookEvent.count({
      where: { eventType: "devolucao", endToEndId: event.endToEndId }
    });
    if (refundInCharge || refundInPayload || refundEvent > 0) {
      const itemId = await openItem({
        event,
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        kind: RECON_KIND.paidAfterRefund,
        message: `Pix ${txid} (${brl(paidAmount)}) da fatura #${invoice.id} tem devolução registrada. Nenhum pagamento foi aplicado e a assinatura NÃO foi renovada; nenhum estorno automático.`,
        metadata: details
      });
      return { ...base, status: "reconciliation", reason: "paid_after_refund", reconciliationItemId: itemId };
    }
  }

  if (!alreadyPaidByTxid && cents(paidAmount) !== cents(invoice.value)) {
    const itemId = await openItem({
      event,
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      kind: RECON_KIND.amountMismatch,
      message: `Pix ${txid}: valor pago ${brl(paidAmount)} difere da fatura #${invoice.id} (${brl(
        invoice.value
      )}). Nada foi aplicado.`,
      metadata: { ...details, paid: paidAmount, expected: Number(invoice.value) }
    });
    return { ...base, status: "reconciliation", reason: "amount_mismatch", reconciliationItemId: itemId };
  }

  const horario = pixEntry?.horario || payload.horario;
  let result: ConfirmGatewayPaymentResult;
  try {
    result = await confirmGatewayPayment({
      invoiceId: invoice.id,
      amount: Number(String(paidAmount).replace(",", ".")),
      method: "pix",
      externalTxid: txid,
      gatewayProvider: "efi",
      gatewayStatus: "CONCLUIDA",
      paidAt: horario && !Number.isNaN(Date.parse(horario)) ? new Date(horario) : undefined,
      metadata: {
        endToEndId: event.endToEndId,
        webhookEventId: event.id,
        chargeSource,
        credentialsSource: gateway.context.source
      },
      cancelledInvoicePolicy: "receive_for_reconciliation"
    });
  } catch (err) {
    // Valor alterado entre a leitura e o lock: determinístico, vira conciliação.
    if (err instanceof AppError && err.message === "ERR_PAYMENT_AMOUNT_MISMATCH") {
      const itemId = await openItem({
        event,
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        kind: RECON_KIND.amountMismatch,
        message: `Pix ${txid}: valor ${brl(paidAmount)} diverge da fatura #${invoice.id}. Nada foi aplicado.`,
        metadata: details
      });
      return { ...base, status: "reconciliation", reason: "amount_mismatch", reconciliationItemId: itemId };
    }
    throw err;
  }

  // Espelho da tentativa fora da transação: falha aqui não perde o pagamento (T-NET-08).
  if (attempt) {
    await SaaSPaymentAttempt.update(
      { status: "completed", gatewayStatus: "CONCLUIDA" },
      { where: { id: attempt.id } }
    ).catch(err =>
      logger.warn({ eventId: event.id, err: sanitizeError(err) }, "[gatewayWebhook] attempt_update_failed")
    );
  }

  const paymentId = result.payment?.id ?? null;
  if (result.cancelledInvoiceReceipt) {
    return {
      ...base,
      status: "reconciliation",
      reason: "cancelled_invoice_receipt",
      paymentId,
      reconciliationItemId: result.reconciliationItemId ?? null
    };
  }
  if (!result.alreadyApplied) {
    return { ...base, status: "applied", reason: result.renewed ? "paid_and_renewed" : "paid", paymentId };
  }
  if (result.payment?.externalTxid === txid && (result.payment.metadata as any)?.cancelledInvoiceReceipt === true) {
    // Replay de recebimento em fatura cancelada (D-P6): continua pendente de decisão.
    const cancelledItem = await SaaSReconciliationItem.findOne({
      where: {
        invoiceId: result.payment.invoiceId,
        kind: GATEWAY_ON_CANCELLED_KIND,
        metadata: { externalTxid: txid }
      } as any
    });
    return {
      ...base,
      status: "reconciliation",
      reason: "cancelled_invoice_receipt",
      paymentId,
      reconciliationItemId: cancelledItem?.id ?? null
    };
  }
  if (result.payment?.externalTxid === txid) {
    const settledItem = await SaaSReconciliationItem.findOne({
      where: { kind: GATEWAY_ON_SETTLED_KIND, metadata: { externalTxid: txid } } as any
    });
    return {
      ...base,
      status: "replay",
      reason: result.payment.source === "gateway" ? "same_txid_already_applied" : "manual_payment_with_txid",
      paymentId,
      reconciliationItemId: settledItem?.id ?? null
    };
  }
  const item =
    result.reconciliationItemId ??
    (
      await SaaSReconciliationItem.findOne({
        where: { invoiceId: invoice.id, metadata: { externalTxid: txid } } as any,
        order: [["id", "DESC"]]
      })
    )?.id ??
    null;
  return {
    ...base,
    status: "reconciliation",
    reason: String(invoice.status).toLowerCase() === "cancelled" ? "cancelled_invoice_duplicate" : "invoice_already_settled",
    paymentId,
    reconciliationItemId: item
  };
}

/** D-P7: devolução só abre conciliação; nunca estorna receita ou assinatura. */
async function processRefund(event: SaaSGatewayWebhookEvent): Promise<Terminal> {
  const payload = (event.payload || {}) as Record<string, any>;
  const dev = payload.devolucao || {};
  const payment = event.txid
    ? await SaaSPayment.findOne({ where: { externalTxid: event.txid } })
    : await SaaSPayment.findOne({ where: { metadata: { endToEndId: event.endToEndId } } as any });
  const attempt = event.txid
    ? await SaaSPaymentAttempt.findOne({ where: { externalTxid: event.txid } })
    : null;
  const companyId = payment?.companyId ?? attempt?.companyId ?? null;
  const invoiceId = payment?.invoiceId ?? attempt?.invoiceId ?? null;
  if (!companyId) {
    return { status: "reconciliation", reason: "refund_without_link", details: { devolucao: dev } };
  }
  // Um item por devolução; os status seguintes ficam no histórico do item.
  const existing = await SaaSReconciliationItem.findOne({
    where: {
      kind: RECON_KIND.refund,
      metadata: { endToEndId: event.endToEndId, devolucaoId: event.devolucaoId }
    } as any
  });
  if (existing) {
    const meta = { ...(existing.metadata || {}) } as Record<string, any>;
    const history = Array.isArray(meta.statusHistory) ? meta.statusHistory : [];
    if (!history.includes(dev.status)) {
      await existing.update({ metadata: { ...meta, lastStatus: dev.status, statusHistory: [...history, dev.status] } });
    }
    return { status: "reconciliation", reason: "refund", companyId, invoiceId, paymentId: payment?.id ?? null, reconciliationItemId: existing.id };
  }
  const itemId = await openItem({
    event,
    companyId,
    invoiceId,
    paymentId: payment?.id ?? null,
    kind: RECON_KIND.refund,
    message: `Devolução Pix ${dev.id || ""} (${brl(dev.valor)}, status ${dev.status || "?"}) do pagamento ${
      event.txid || event.endToEndId
    }. Nenhum estorno automático: a fatura, a receita e a assinatura não foram alteradas.`,
    metadata: {
      devolucaoId: event.devolucaoId,
      lastStatus: dev.status,
      statusHistory: [dev.status],
      refundAmount: dev.valor,
      paymentId: payment?.id ?? null
    }
  });
  return { status: "reconciliation", reason: "refund", companyId, invoiceId, paymentId: payment?.id ?? null, reconciliationItemId: itemId };
}

async function exhaustOrRetry(
  event: SaaSGatewayWebhookEvent,
  workerId: string,
  err: TransientError | Error
): Promise<ProcessOutcome> {
  const code = err instanceof TransientError ? err.code : "transient_error";
  const lastError = err instanceof TransientError ? redactEfiSensitiveText(err.message).slice(0, 240) : sanitizeError(err);
  if (event.attempts >= GATEWAY_WEBHOOK_MAX_ATTEMPTS) {
    let itemId: number | null = null;
    const attempt = event.txid ? await SaaSPaymentAttempt.findOne({ where: { externalTxid: event.txid } }) : null;
    const companyId = attempt?.companyId ?? event.companyId ?? null;
    if (companyId) {
      itemId = await openItem({
        event,
        companyId,
        invoiceId: attempt?.invoiceId ?? event.invoiceId,
        kind: RECON_KIND.exhausted,
        message: `Notificação Pix ${event.txid || event.endToEndId} (${brl(event.amount)}) não pôde ser processada após ${event.attempts} tentativas (${code}). Verifique e reprocesse.`,
        metadata: { lastError }
      }).catch(() => null);
    }
    await finalize(
      event,
      workerId,
      {
        status: "failed_exhausted",
        lastError,
        processedAt: new Date(),
        companyId,
        invoiceId: attempt?.invoiceId ?? event.invoiceId,
        reconciliationItemId: itemId,
        result: { ...(event.result || {}), reason: code, exhausted: true }
      } as any,
      { result: "failed_exhausted", error: lastError }
    );
    logger.error({ eventId: event.id, code }, "[gatewayWebhook] failed_exhausted");
    return { outcome: "failed_exhausted", reason: code };
  }
  const delayMin = backoffMinutes(event.attempts);
  const nextAttemptAt = new Date(Date.now() + delayMin * 60000);
  const ok = await finalize(
    event,
    workerId,
    { status: "retry_scheduled", lastError, nextAttemptAt } as any,
    { result: "retry_scheduled", error: lastError, delayMin }
  );
  if (ok) await publishGatewayWebhookEvent(event.id, event.attempts, delayMin * 60000);
  logger.warn({ eventId: event.id, code, attempts: event.attempts, delayMin }, "[gatewayWebhook] retry_scheduled");
  return { outcome: "retry_scheduled", reason: code };
}

/** Processa um evento (job Bull ou chamada direta em teste). Nunca lança para o Bull. */
export async function processGatewayWebhookEvent(
  eventId: number,
  opts: { workerId?: string; gateway?: EfiPixChargeGateway } = {}
): Promise<ProcessOutcome> {
  const workerId = opts.workerId || DEFAULT_WORKER_ID;
  // R-33: pausa sem perder eventos — nada é tocado; a recuperação republica ao retomar.
  if (getEfiActivationControls().webhookWorkerPaused) return { outcome: "skipped", reason: "paused" };

  let event: SaaSGatewayWebhookEvent | null;
  try {
    event = await claimGatewayWebhookEvent(eventId, workerId);
  } catch (err) {
    logger.warn({ eventId, err: sanitizeError(err) }, "[gatewayWebhook] claim_failed");
    return { outcome: "skipped", reason: "not_claimed" };
  }
  if (!event) return { outcome: "skipped", reason: "not_claimed" };

  // Evento que derruba o worker repetidamente não fica em loop: o claim conta a tentativa.
  if (event.attempts > GATEWAY_WEBHOOK_MAX_ATTEMPTS) {
    return exhaustOrRetry(event, workerId, new TransientError("attempts_exceeded"));
  }

  try {
    let terminal: Terminal;
    if (event.eventType === "pix") {
      const gateway = opts.gateway || (await getEfiPixChargeGateway().catch(err => {
        throw new TransientError("gateway_unavailable", sanitizeError(err));
      }));
      terminal = await processPix(event, gateway);
    } else if (event.eventType === "devolucao") {
      terminal = await processRefund(event);
    } else if (event.eventType === "teste") {
      terminal = { status: "ignored_not_saas", reason: "teste" };
    } else {
      terminal = { status: "invalid_permanent", reason: "invalid_item" };
    }
    await finalize(
      event,
      workerId,
      {
        status: terminal.status,
        lastError: null,
        processedAt: new Date(),
        companyId: terminal.companyId ?? event.companyId ?? null,
        invoiceId: terminal.invoiceId ?? event.invoiceId ?? null,
        paymentId: terminal.paymentId ?? event.paymentId ?? null,
        reconciliationItemId: terminal.reconciliationItemId ?? event.reconciliationItemId ?? null,
        result: { reason: terminal.reason, ...(terminal.details || {}) }
      } as any,
      { result: terminal.status, reason: terminal.reason }
    );
    logger.info(
      {
        eventId: event.id,
        status: terminal.status,
        reason: terminal.reason,
        invoiceId: terminal.invoiceId ?? null,
        companyId: terminal.companyId ?? null,
        txidSuffix: event.txid ? event.txid.slice(-6) : null,
        e2eSuffix: event.endToEndId ? event.endToEndId.slice(-6) : null
      },
      "[gatewayWebhook] processado"
    );
    return { outcome: terminal.status, reason: terminal.reason };
  } catch (err) {
    try {
      return await exhaustOrRetry(event, workerId, err as Error);
    } catch (finalErr) {
      // Banco indisponível até para gravar a retentativa: o lock expira e a recuperação retoma.
      logger.error(
        { eventId: event.id, err: sanitizeError(finalErr) },
        "[gatewayWebhook] falha ao registrar retentativa — recuperação por lock antigo"
      );
      return { outcome: "processing", reason: "stale_until_recovery" };
    }
  }
}
