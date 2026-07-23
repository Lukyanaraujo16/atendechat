import { getAgentOsQueueProvider } from "./providers";
import { hashRequestPayload } from "./providers/InMemoryProviders";
import { getScalabilityConfig } from "./ScalabilityConfig";
import { classifyAgentOsError, isRetryable, computeBackoffMs } from "./RetryPolicy";
import { runIdempotencyCleanupBatch } from "./HealthProbes";
import { validateAgentOsConsistency } from "./ConsistencyValidator";
import { rebuildExecutionFromPersistence } from "../observability/PersistentReplayService";
import { withDistributedLock } from "./CacheAndLocks";
import { beatAgentOsWorker } from "./WorkerRegistry";
import { agentOsLog } from "../observability/StructuredLogger";

export async function enqueueAgentOsJob(input: {
  type: string;
  companyId?: number | null;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  deduplicationKey?: string | null;
  delayMs?: number;
}) {
  return getAgentOsQueueProvider().enqueue({
    ...input,
    maxAttempts: getScalabilityConfig().retry.maxAttempts
  });
}

export async function processAgentOsJob(jobId: string): Promise<unknown> {
  const q = getAgentOsQueueProvider();
  const job = await q.getJob(jobId);
  if (!job) throw new Error("ERR_JOB_NOT_FOUND");

  const run = async () => {
    switch (job.type) {
      case "idempotency_cleanup":
        return runIdempotencyCleanupBatch();
      case "consistency_validation":
        return validateAgentOsConsistency(Number(job.companyId || 0));
      case "replay_rebuild": {
        const traceId = String(job.payload.traceId || "");
        if (!traceId || !job.companyId) throw new Error("ERR_OBS_TRACE_REQUIRED");
        return rebuildExecutionFromPersistence({
          companyId: job.companyId,
          traceId
        });
      }
      case "retention_cleanup":
        return runIdempotencyCleanupBatch();
      case "metrics_aggregation":
        return { ok: true, note: "bucket already write-through" };
      case "export_generation":
        return {
          status: "ready",
          format: job.payload.format || "json",
          chunks: 1
        };
      default:
        return { ok: true, type: job.type };
    }
  };

  try {
    if (job.companyId) {
      return await withDistributedLock({
        companyId: job.companyId,
        resource: "job",
        resourceId: job.deduplicationKey || job.jobId,
        fn: run
      });
    }
    return await run();
  } catch (err) {
    const cls = classifyAgentOsError(err);
    agentOsLog("warn", {
      type: "job.error",
      jobId,
      retryClass: cls,
      error: err instanceof Error ? err.message : String(err)
    });
    if (!isRetryable(cls) || job.attempts + 1 >= job.maxAttempts) {
      await q.markDeadLetter(
        jobId,
        err instanceof Error ? err.message : "ERR_JOB"
      );
    }
    throw err;
  }
}

export async function scheduleDefaultAgentOsJobs(companyId?: number) {
  await beatAgentOsWorker("online");
  await enqueueAgentOsJob({
    type: "idempotency_cleanup",
    companyId: companyId ?? null,
    payload: {},
    deduplicationKey: `cleanup:idempotency:${companyId || "global"}`
  });
}

export function buildDedupKey(
  companyId: number,
  type: string,
  payload: unknown
): string {
  return `${companyId}:${type}:${hashRequestPayload(payload)}`;
}

export { computeBackoffMs };
