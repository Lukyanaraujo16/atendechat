import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { logger } from "../../utils/logger";
import { getEfiActivationControls } from "../../config/saasBillingFlags";
import SaaSGatewayWebhookEvent, {
  GATEWAY_WEBHOOK_PENDING_STATUSES
} from "../../models/SaaSGatewayWebhookEvent";
import {
  getGatewayWebhookQueue,
  GATEWAY_WEBHOOK_JOB_NAME,
  publishGatewayWebhookEvent
} from "../../libs/gatewayWebhookQueue";
import { isEfiWebhookPipelineAsyncActive } from "./efiFinancialSource";
import { processGatewayWebhookEvent } from "./processGatewayWebhookEvent";

/**
 * Recuperação e bootstrap do pipeline `async` (B3.3, RF3.12, R-27, R-33).
 * O PostgreSQL é a fonte da verdade: a recuperação lê o banco e republica; nunca o contrário.
 */

/** Lock mais antigo que isso volta para `retry_scheduled` (R-27, PT-11). */
export const GATEWAY_WEBHOOK_STALE_LOCK_MIN = 10;
/** Indicador "pendente há mais de X min" (RF3.19). */
export const GATEWAY_WEBHOOK_PENDING_ALERT_MIN = 15;
const RECOVERY_BATCH = 200;
const QUEUE_OP_TIMEOUT_MS = 3000;

function withTimeout<T>(p: Promise<T>, ms = QUEUE_OP_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("queue_timeout")), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

export type RecoveryReport = {
  skipped?: "inactive" | "paused" | "running";
  staleReleased: number;
  republished: number;
  publishFailed: number;
  orphanJobsRemoved: number;
  queueReconciled: boolean;
};

let recoveryRunning = false;

export async function recoverGatewayWebhookEvents(
  opts: { force?: boolean } = {}
): Promise<RecoveryReport> {
  const report: RecoveryReport = {
    staleReleased: 0,
    republished: 0,
    publishFailed: 0,
    orphanJobsRemoved: 0,
    queueReconciled: false
  };
  if (!opts.force && !isEfiWebhookPipelineAsyncActive()) return { ...report, skipped: "inactive" };
  if (getEfiActivationControls().webhookWorkerPaused) return { ...report, skipped: "paused" };
  if (recoveryRunning) return { ...report, skipped: "running" };
  recoveryRunning = true;
  try {
    // (b) lock antigo → retry_scheduled (worker morreu entre o claim e o resultado).
    const stale = await sequelize.query<{ id: number }>(
      `UPDATE "SaaSGatewayWebhookEvents"
          SET status = 'retry_scheduled', "lockedBy" = NULL, "lockedAt" = NULL,
              "nextAttemptAt" = now(), "lastError" = 'lock expirado (worker interrompido)', "updatedAt" = now()
        WHERE status = 'processing' AND "lockedAt" < now() - (:min || ' minutes')::interval
        RETURNING id`,
      { type: QueryTypes.SELECT, replacements: { min: String(GATEWAY_WEBHOOK_STALE_LOCK_MIN) } }
    );
    report.staleReleased = stale.length;

    // (a) pendentes vencidos → republicar (mesmo jobId da tentativa: o Bull deduplica job vivo).
    const due = await sequelize.query<{ id: number; attempts: number }>(
      `SELECT id, attempts FROM "SaaSGatewayWebhookEvents"
        WHERE status IN ('received','retry_scheduled') AND "nextAttemptAt" <= now()
        ORDER BY "nextAttemptAt" ASC LIMIT ${RECOVERY_BATCH}`,
      { type: QueryTypes.SELECT }
    );
    for (const e of due) {
      if (await publishGatewayWebhookEvent(e.id, e.attempts)) report.republished += 1;
      else report.publishFailed += 1;
    }

    // (c) fila × banco: job sem evento ou com evento terminal → remover.
    try {
      const queue = getGatewayWebhookQueue();
      const jobs = await withTimeout(queue.getJobs(["waiting", "delayed"], 0, 499));
      const ids = [...new Set(jobs.map(j => Number(j?.data?.eventId)).filter(Number.isInteger))];
      const alive = ids.length
        ? await SaaSGatewayWebhookEvent.findAll({
            attributes: ["id", "status"],
            where: { id: ids, status: GATEWAY_WEBHOOK_PENDING_STATUSES }
          })
        : [];
      const aliveIds = new Set(alive.map(a => a.id));
      for (const job of jobs) {
        if (job && !aliveIds.has(Number(job.data?.eventId))) {
          await withTimeout(job.remove()).catch(() => undefined);
          report.orphanJobsRemoved += 1;
        }
      }
      report.queueReconciled = true;
    } catch (err) {
      logger.warn({ err: (err as Error)?.message }, "[gatewayWebhook] conferência fila × banco indisponível");
    }
    if (report.staleReleased || report.republished || report.publishFailed || report.orphanJobsRemoved) {
      logger.info(report, "[gatewayWebhook] recuperação");
    }
    return report;
  } finally {
    recoveryRunning = false;
  }
}

let started = false;

/** Boot: registra o worker e a recuperação só com o pipeline `async` ativo (default: nada). */
export function startGatewayWebhookPipeline(): void {
  if (started) return;
  if (!isEfiWebhookPipelineAsyncActive()) {
    logger.info("[gatewayWebhook] pipeline async inativo — worker e recuperação não registrados");
    return;
  }
  started = true;
  const queue = getGatewayWebhookQueue();
  queue.process(GATEWAY_WEBHOOK_JOB_NAME, 2, async job => {
    const out = await processGatewayWebhookEvent(Number(job.data.eventId));
    return out;
  });
  cron.schedule("* * * * *", async () => {
    try {
      await recoverGatewayWebhookEvents();
    } catch (err) {
      logger.warn({ err: (err as Error)?.message }, "[gatewayWebhook] recuperação falhou");
    }
  });
  logger.info(
    { paused: getEfiActivationControls().webhookWorkerPaused },
    "[gatewayWebhook] worker e recuperação registrados"
  );
}

export type GatewayWebhookStats = {
  byStatus: Record<string, number>;
  pending: number;
  /** Pendentes vencidos há mais de GATEWAY_WEBHOOK_PENDING_ALERT_MIN. */
  pendingOverdue: number;
  oldestPendingAgeSec: number | null;
  staleProcessing: number;
  queue: { available: boolean; waiting: number | null; delayed: number | null; active: number | null };
  /** Pendentes (não em espera de backoff) − jobs vivos; > 0 indica eventos sem job (RNF9). */
  eventsWithoutJob: number | null;
};

export async function getGatewayWebhookPipelineStats(): Promise<GatewayWebhookStats> {
  const rows = await sequelize.query<{ status: string; total: string }>(
    `SELECT status, COUNT(*)::text AS total FROM "SaaSGatewayWebhookEvents" GROUP BY status`,
    { type: QueryTypes.SELECT }
  );
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = Number(r.total);
  const [agg] = await sequelize.query<{
    pending: string;
    overdue: string;
    oldest: string | null;
    stale: string;
    due: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('received','retry_scheduled','processing'))::text AS pending,
       COUNT(*) FILTER (WHERE status IN ('received','retry_scheduled')
         AND "nextAttemptAt" < now() - (:alert || ' minutes')::interval)::text AS overdue,
       EXTRACT(EPOCH FROM now() - MIN("receivedAt") FILTER (
         WHERE status IN ('received','retry_scheduled','processing')))::text AS oldest,
       COUNT(*) FILTER (WHERE status = 'processing'
         AND "lockedAt" < now() - (:stale || ' minutes')::interval)::text AS stale,
       COUNT(*) FILTER (WHERE status IN ('received','retry_scheduled','processing'))::text AS due
     FROM "SaaSGatewayWebhookEvents"`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        alert: String(GATEWAY_WEBHOOK_PENDING_ALERT_MIN),
        stale: String(GATEWAY_WEBHOOK_STALE_LOCK_MIN)
      }
    }
  );
  const stats: GatewayWebhookStats = {
    byStatus,
    pending: Number(agg?.pending || 0),
    pendingOverdue: Number(agg?.overdue || 0),
    oldestPendingAgeSec: agg?.oldest != null ? Math.round(Number(agg.oldest)) : null,
    staleProcessing: Number(agg?.stale || 0),
    queue: { available: false, waiting: null, delayed: null, active: null },
    eventsWithoutJob: null
  };
  // A fila só é consultada com o pipeline ativo (default: nenhuma conexão Redis nova).
  if (isEfiWebhookPipelineAsyncActive()) {
    try {
      const c = await withTimeout(getGatewayWebhookQueue().getJobCounts());
      stats.queue = { available: true, waiting: c.waiting, delayed: c.delayed, active: c.active };
      stats.eventsWithoutJob = Math.max(0, Number(agg?.due || 0) - (c.waiting + c.delayed + c.active));
    } catch {
      stats.queue.available = false;
    }
  }
  return stats;
}
