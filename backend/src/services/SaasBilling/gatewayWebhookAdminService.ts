import { Op, WhereOptions } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSPaymentAttempt from "../../models/SaaSPaymentAttempt";
import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import SaaSGatewayWebhookEvent, {
  GatewayWebhookEventStatus,
  GATEWAY_WEBHOOK_PENDING_STATUSES
} from "../../models/SaaSGatewayWebhookEvent";
import { logger } from "../../utils/logger";
import { recordEfiConfigAudit } from "./efiConfigAudit";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { assertRuntimeReadyForEfiAdmin } from "./platformEfiConfigSerialize";
import {
  isEfiPixReconciliationSweepActive,
  isEfiWebhookPipelineAsyncActive
} from "./efiFinancialSource";
import { getEfiPixChargeGateway, EfiPixCob } from "./efiPixChargeGateway";
import { publishGatewayWebhookEvent } from "../../libs/gatewayWebhookQueue";
import { getGatewayWebhookPipelineStats, GatewayWebhookStats } from "./gatewayWebhookPipeline";
import { RECON_KIND } from "./processGatewayWebhookEvent";

/**
 * Administração do pipeline de webhook e da conciliação (B3.3, RF3.16–RF3.19, R-11, R-30).
 * Só Super Admin (rotas `isAuth + isSuper`). Nenhuma ação altera pagamento ou assinatura
 * diretamente: reprocessar devolve o evento ao mesmo pipeline idempotente; resolver
 * conciliação só registra a decisão (A1).
 */

export const REPROCESSABLE_STATUSES: GatewayWebhookEventStatus[] = [
  "failed_exhausted",
  "invalid_permanent",
  "unlinked",
  "reconciliation"
];
export const PIX_SWEEP_KIND = "pix_sweep_concluded_without_payment";
const NOTE_MIN = 5;
const NOTE_MAX = 1000;

function requireNote(note: unknown): string {
  const n = typeof note === "string" ? note.trim() : "";
  if (n.length < NOTE_MIN) {
    throw new AppError("ERR_NOTE_REQUIRED", 400, `Informe uma justificativa (mínimo ${NOTE_MIN} caracteres).`);
  }
  return n.slice(0, NOTE_MAX);
}

function page(input: { page?: unknown; limit?: unknown }): { page: number; limit: number; offset: number } {
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const p = Math.max(1, Number(input.page) || 1);
  return { page: p, limit, offset: (p - 1) * limit };
}

/** DTO sanitizado: sem `chaveHash` (só máscara), sem nada além do payload mínimo. */
export function serializeGatewayWebhookEvent(e: SaaSGatewayWebhookEvent, detail = false) {
  const payload = { ...((e.payload || {}) as Record<string, unknown>) };
  delete payload.chaveHash;
  const base = {
    id: e.id,
    eventType: e.eventType,
    status: e.status,
    txid: e.txid,
    endToEndId: e.endToEndId,
    devolucaoId: e.devolucaoId,
    amount: e.amount != null ? Number(e.amount) : null,
    companyId: e.companyId,
    invoiceId: e.invoiceId,
    paymentId: e.paymentId,
    reconciliationItemId: e.reconciliationItemId,
    credentialsSource: e.credentialsSource,
    attempts: e.attempts,
    nextAttemptAt: e.nextAttemptAt,
    lastError: e.lastError,
    reason: (e.result as any)?.reason ?? null,
    receivedAt: e.receivedAt,
    processedAt: e.processedAt,
    reprocessable: REPROCESSABLE_STATUSES.includes(e.status)
  };
  if (!detail) return base;
  return {
    ...base,
    payload,
    result: e.result,
    lockedBy: e.lockedBy,
    lockedAt: e.lockedAt,
    attemptLog: e.attemptLog || [],
    adminActions: e.adminActions || []
  };
}

/** RF3.19: lista com filtros (status ou grupo `pending`, txid, empresa), paginada. */
export async function listGatewayWebhookEvents(query: Record<string, unknown>) {
  const { page: p, limit, offset } = page(query);
  const where: Record<string, unknown> = {};
  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (status === "pending") where.status = GATEWAY_WEBHOOK_PENDING_STATUSES;
  else if (status) where.status = status;
  if (typeof query.txid === "string" && query.txid.trim()) where.txid = query.txid.trim();
  if (typeof query.endToEndId === "string" && query.endToEndId.trim()) where.endToEndId = query.endToEndId.trim();
  if (query.companyId !== undefined && query.companyId !== "") {
    const companyId = Number(query.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) throw new AppError("ERR_INVALID_COMPANY", 400);
    where.companyId = companyId;
  }
  const { rows, count } = await SaaSGatewayWebhookEvent.findAndCountAll({
    where: where as WhereOptions,
    order: [["id", "DESC"]],
    limit,
    offset
  });
  return {
    events: rows.map(r => serializeGatewayWebhookEvent(r)),
    total: count,
    page: p,
    limit,
    hasMore: offset + rows.length < count
  };
}

export async function getGatewayWebhookEventDetail(id: number) {
  const e = await SaaSGatewayWebhookEvent.findByPk(id);
  if (!e) throw new AppError("ERR_NOT_FOUND", 404, "Evento não encontrado.");
  return serializeGatewayWebhookEvent(e, true);
}

export async function getGatewayWebhookAdminStats(): Promise<
  GatewayWebhookStats & { pipelineActive: boolean }
> {
  return { ...(await getGatewayWebhookPipelineStats()), pipelineActive: isEfiWebhookPipelineAsyncActive() };
}

/** R-30 / RF3.16: reprocessamento manual auditado; volta a `received` e percorre o pipeline. */
export async function reprocessGatewayWebhookEvent(input: {
  id: number;
  actorUserId: number;
  note: unknown;
}) {
  const note = requireNote(input.note);
  if (!isEfiWebhookPipelineAsyncActive()) {
    throw new AppError(
      "ERR_EFI_WEBHOOK_PIPELINE_INACTIVE",
      409,
      "O pipeline assíncrono não está ativo: não há worker para reprocessar."
    );
  }
  const runtime = assertRuntimeReadyForEfiAdmin();
  const event = await sequelize.transaction(async t => {
    const e = await SaaSGatewayWebhookEvent.findByPk(input.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!e) throw new AppError("ERR_NOT_FOUND", 404, "Evento não encontrado.");
    if (!REPROCESSABLE_STATUSES.includes(e.status)) {
      throw new AppError(
        "ERR_WEBHOOK_EVENT_NOT_REPROCESSABLE",
        409,
        `Evento com status ${e.status} não pode ser reprocessado.`
      );
    }
    const action = {
      at: new Date().toISOString(),
      actorUserId: input.actorUserId,
      action: "reprocess",
      fromStatus: e.status,
      note
    };
    await e.update(
      {
        status: "received",
        // Tentativas zeradas: o reprocessamento é uma nova rodada (o histórico fica em attemptLog).
        attempts: 0,
        nextAttemptAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        lastError: null,
        adminActions: [...(e.adminActions || []), action]
      } as any,
      { transaction: t }
    );
    await recordEfiConfigAudit({
      slot: runtime.slot,
      actorUserId: input.actorUserId,
      action: "webhook_event_reprocess",
      diffSummary: { webhookEventId: e.id, fromStatus: action.fromStatus, note },
      transaction: t
    });
    return e;
  });
  const queued = await publishGatewayWebhookEvent(event.id, 0);
  logger.info({ eventId: event.id, actorUserId: input.actorUserId, queued }, "[gatewayWebhook] reprocess");
  return { event: serializeGatewayWebhookEvent(event, true), queued };
}

/** D-P8 / T-REC-10: `unlinked` → conciliação (com empresa) ou "não é SaaS", com nota. */
export async function classifyUnlinkedGatewayWebhookEvent(input: {
  id: number;
  actorUserId: number;
  action: unknown;
  note: unknown;
  companyId?: unknown;
  invoiceId?: unknown;
}) {
  const note = requireNote(input.note);
  if (input.action !== "convert_to_reconciliation" && input.action !== "mark_not_saas") {
    throw new AppError("ERR_VALIDATION", 400, "Ação inválida.");
  }
  const runtime = assertRuntimeReadyForEfiAdmin();
  return sequelize.transaction(async t => {
    const e = await SaaSGatewayWebhookEvent.findByPk(input.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!e) throw new AppError("ERR_NOT_FOUND", 404, "Evento não encontrado.");
    if (e.status !== "unlinked") {
      throw new AppError("ERR_WEBHOOK_EVENT_NOT_UNLINKED", 409, "Só eventos sem vínculo podem ser classificados.");
    }
    const action = {
      at: new Date().toISOString(),
      actorUserId: input.actorUserId,
      action: input.action,
      fromStatus: e.status,
      note
    };
    let itemId: number | null = null;
    let companyId: number | null = null;
    let invoiceId: number | null = null;
    if (input.action === "convert_to_reconciliation") {
      companyId = Number(input.companyId);
      if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new AppError("ERR_INVALID_COMPANY", 400, "Informe a empresa do pagamento.");
      }
      if (!(await Company.findByPk(companyId, { transaction: t, attributes: ["id"] }))) {
        throw new AppError("ERR_NO_COMPANY_FOUND", 400, "Empresa não encontrada.");
      }
      if (input.invoiceId !== undefined && input.invoiceId !== null && input.invoiceId !== "") {
        invoiceId = Number(input.invoiceId);
        const inv = await Invoices.findByPk(invoiceId, { transaction: t });
        if (!inv || inv.companyId !== companyId) {
          throw new AppError("ERR_FORBIDDEN_INVOICE", 400, "Fatura não pertence à empresa informada.");
        }
      }
      // Idempotente por eventKey: reprocessar e converter de novo não duplica o item.
      const existing = await SaaSReconciliationItem.findOne({
        where: { kind: RECON_KIND.unlinkedConverted, metadata: { eventKey: e.eventKey } } as any,
        transaction: t
      });
      const item = existing ?? await SaaSReconciliationItem.create(
        {
          companyId,
          invoiceId,
          paymentId: null,
          kind: RECON_KIND.unlinkedConverted,
          status: "pending",
          message: `Pix sem txid (${e.endToEndId}, R$ ${Number(e.amount || 0).toFixed(
            2
          )}) vinculado manualmente a esta empresa. Nada foi aplicado; decida a baixa ou a devolução.`,
          retryCount: 0,
          lastError: null,
          metadata: {
            eventKey: e.eventKey,
            webhookEventId: e.id,
            endToEndId: e.endToEndId,
            amount: e.amount != null ? Number(e.amount) : null,
            convertedByUserId: input.actorUserId,
            note
          }
        } as any,
        { transaction: t }
      );
      itemId = item.id;
    }
    await e.update(
      {
        status: input.action === "mark_not_saas" ? "ignored_not_saas" : "reconciliation",
        companyId: companyId ?? e.companyId,
        invoiceId: invoiceId ?? e.invoiceId,
        reconciliationItemId: itemId ?? e.reconciliationItemId,
        result: { ...(e.result || {}), manualClassification: input.action },
        adminActions: [...(e.adminActions || []), action]
      } as any,
      { transaction: t }
    );
    await recordEfiConfigAudit({
      slot: runtime.slot,
      actorUserId: input.actorUserId,
      action: "webhook_event_classify",
      diffSummary: { webhookEventId: e.id, classification: input.action, reconciliationItemId: itemId, note },
      transaction: t
    });
    return { event: serializeGatewayWebhookEvent(e, true), reconciliationItemId: itemId };
  });
}

/** RF3.17: fila global paginada (`status=open|resolved|all`, `kind`, `companyId`). */
export async function listReconciliationItemsPaged(query: Record<string, unknown>) {
  const { page: p, limit, offset } = page({ page: query.page, limit: query.limit ?? 100 });
  const where: Record<string, unknown> = {};
  const status = typeof query.status === "string" ? query.status : "open";
  if (status === "open") where.status = { [Op.ne]: "resolved" };
  else if (status === "resolved") where.status = "resolved";
  else if (status !== "all") throw new AppError("ERR_VALIDATION", 400, "status inválido.");
  if (typeof query.kind === "string" && query.kind.trim()) where.kind = query.kind.trim();
  if (query.companyId !== undefined && query.companyId !== "") {
    const companyId = Number(query.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) throw new AppError("ERR_INVALID_COMPANY", 400);
    where.companyId = companyId;
  }
  const { rows, count } = await SaaSReconciliationItem.findAndCountAll({
    where: where as WhereOptions,
    order: [["id", "DESC"]],
    limit,
    offset
  });
  return { items: rows, total: count, page: p, limit, hasMore: offset + rows.length < count };
}

/**
 * R-11 / RF3.17: resolução com nota obrigatória, lock, só item aberto, ator, evento no ledger
 * e mensagem original preservada (a decisão fica em `metadata.resolution`).
 */
export async function resolveReconciliationItemAudited(input: {
  id: number;
  actorUserId: number;
  note: unknown;
}) {
  const note = requireNote(input.note);
  return sequelize.transaction(async t => {
    const item = await SaaSReconciliationItem.findByPk(input.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!item) throw new AppError("ERR_NOT_FOUND", 404);
    if (item.status === "resolved") {
      throw new AppError("ERR_RECONCILIATION_ALREADY_RESOLVED", 409, "Item já resolvido.");
    }
    const resolvedAt = new Date();
    const resolution = {
      note,
      actorUserId: input.actorUserId,
      at: resolvedAt.toISOString(),
      previousStatus: item.status
    };
    await item.update(
      { status: "resolved", resolvedAt, metadata: { ...(item.metadata || {}), resolution } },
      { transaction: t }
    );
    await recordFinancialEvent({
      companyId: item.companyId,
      invoiceId: item.invoiceId,
      paymentId: item.paymentId,
      eventType: "reconciliation_resolved",
      actorUserId: input.actorUserId,
      idempotencyKey: `evt:recon-resolved:${item.id}`,
      payload: { reconciliationItemId: item.id, kind: item.kind, note, previousStatus: resolution.previousStatus },
      transaction: t
    });
    return item;
  });
}

/**
 * D-P10 / RF3.18: varredura Efí × local, só leitura na Efí, saída em conciliação.
 * Parte das tentativas Pix locais com txid (inclui as legadas) e procura cobrança CONCLUIDA
 * sem pagamento local (P-B32-06). Nunca dá baixa. Idempotente por txid (T-REC-06).
 */
export async function runPixReconciliationSweep(input: {
  actorUserId: number;
  confirm: unknown;
  days?: unknown;
}) {
  if (!isEfiPixReconciliationSweepActive()) {
    throw new AppError("ERR_EFI_PIX_SWEEP_DISABLED", 403, "Varredura Pix desabilitada.");
  }
  if (input.confirm !== true) {
    throw new AppError("ERR_EFI_PIX_SWEEP_CONFIRM_REQUIRED", 400, "Confirme a varredura.");
  }
  const days = Math.min(30, Math.max(1, Number(input.days) || 7));
  const runtime = assertRuntimeReadyForEfiAdmin();
  const since = new Date(Date.now() - days * 86400000);
  const attempts = await SaaSPaymentAttempt.findAll({
    where: { method: "pix", externalTxid: { [Op.ne]: null }, createdAt: { [Op.gte]: since } } as any,
    order: [["id", "ASC"]],
    limit: 200
  });
  const gateway = await getEfiPixChargeGateway();
  const report = { checked: 0, concludedWithoutPayment: 0, itemsCreated: 0, pendingInPipeline: 0, errors: 0 };
  for (const a of attempts) {
    const txid = String(a.externalTxid);
    if (await SaaSPayment.findOne({ where: { externalTxid: txid } })) continue;
    report.checked += 1;
    let cob: EfiPixCob | null;
    try {
      cob = await gateway.getCharge(txid);
    } catch {
      report.errors += 1;
      continue;
    }
    if (!cob || String(cob.status).toUpperCase() !== "CONCLUIDA") continue;
    report.concludedWithoutPayment += 1;
    const inPipeline = await SaaSGatewayWebhookEvent.count({
      where: { txid, eventType: "pix", status: GATEWAY_WEBHOOK_PENDING_STATUSES }
    });
    if (inPipeline > 0) {
      report.pendingInPipeline += 1;
      continue;
    }
    const existing = await SaaSReconciliationItem.findOne({
      where: { kind: PIX_SWEEP_KIND, metadata: { externalTxid: txid } } as any
    });
    if (existing) continue;
    await SaaSReconciliationItem.create({
      companyId: a.companyId,
      invoiceId: a.invoiceId,
      paymentId: null,
      kind: PIX_SWEEP_KIND,
      status: "pending",
      message: `Varredura: a cobrança Pix ${txid} (R$ ${String(cob.valor?.original ?? "?")}) está CONCLUIDA na Efí, mas não há pagamento local. Nenhuma baixa automática: confira e reprocesse a notificação ou dê baixa.`,
      retryCount: 0,
      lastError: null,
      metadata: {
        externalTxid: txid,
        attemptId: a.id,
        chargeAmount: cob.valor?.original ?? null,
        endToEndIds: (cob.pix || []).map(px => px.endToEndId).filter(Boolean),
        credentialsSource: gateway.context.source
      }
    } as any);
    report.itemsCreated += 1;
  }
  await recordEfiConfigAudit({
    configId: gateway.context.configId,
    slot: runtime.slot,
    actorUserId: input.actorUserId,
    action: "pix_sweep",
    diffSummary: { days, ...report }
  });
  logger.info({ actorUserId: input.actorUserId, days, ...report }, "[efiAdmin] pix_sweep");
  return { days, ...report };
}
