import { assertAgentOsPlanFeature } from "../security/AgentOsPlanGate";
import { AGENTOS_FEATURE_KEYS } from "../../../config/automationAgentOsSecurityConstants";
import { buildScalabilityHealth, getQueueHealthProbe, runIdempotencyCleanupBatch } from "./HealthProbes";
import { getAgentOsQueueProvider, useInMemoryAgentOsProviders } from "./providers";
import { enqueueAgentOsJob, processAgentOsJob, scheduleDefaultAgentOsJobs } from "./JobRunner";
import { validateAgentOsConsistency } from "./ConsistencyValidator";
import { beatAgentOsWorker, listAgentOsWorkers } from "./WorkerRegistry";
import { getScalabilityConfig, setScalabilityConfig } from "./ScalabilityConfig";
import { emitCacheInvalidation, withDistributedLock } from "./CacheAndLocks";
import { getAgentOsIdempotencyProvider } from "./providers";
import { hashRequestPayload } from "./providers/InMemoryProviders";
import { newLockOwnerToken } from "./providers/RedisProviders";
import { paginateByCreatedAtId, clampPageLimit } from "./Pagination";
import { readMetricBuckets } from "./DistributedMetrics";

async function assertMon(companyId: number) {
  await assertAgentOsPlanFeature(companyId, AGENTOS_FEATURE_KEYS.monitor);
}

export async function GetScalabilityHealthService(input: { companyId: number }) {
  await assertMon(input.companyId);
  return buildScalabilityHealth(input.companyId);
}

export async function GetQueueHealthService(input: { companyId: number }) {
  await assertMon(input.companyId);
  return getQueueHealthProbe();
}

export async function ListWorkersService(input: { companyId: number }) {
  await assertMon(input.companyId);
  await beatAgentOsWorker("online");
  return listAgentOsWorkers();
}

export async function ListJobsService(input: {
  companyId: number;
  status?: string;
  limit?: number;
}) {
  await assertMon(input.companyId);
  const jobs = await getAgentOsQueueProvider().listJobs({
    companyId: input.companyId,
    status: input.status as any,
    limit: clampPageLimit(input.limit)
  });
  return paginateByCreatedAtId(
    jobs.map(j => ({ ...j, id: j.jobId, createdAt: j.scheduledAt })),
    { limit: input.limit }
  );
}

export async function EnqueueJobService(input: {
  companyId: number;
  type: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
}) {
  await assertMon(input.companyId);
  return enqueueAgentOsJob({
    type: input.type,
    companyId: input.companyId,
    payload: input.payload || {},
    correlationId: input.correlationId
  });
}

export async function ReprocessDeadLetterService(input: {
  companyId: number;
  jobId: string;
}) {
  await assertMon(input.companyId);
  const job = await getAgentOsQueueProvider().getJob(input.jobId);
  if (!job || (job.companyId != null && job.companyId !== input.companyId)) {
    throw new Error("ERR_JOB_NOT_FOUND");
  }
  return getAgentOsQueueProvider().requeue(input.jobId);
}

export async function RunCleanupService(input: { companyId: number }) {
  await assertMon(input.companyId);
  return withDistributedLock({
    companyId: input.companyId,
    resource: "cleanup",
    resourceId: "idempotency",
    fn: () => runIdempotencyCleanupBatch()
  });
}

export async function RunConsistencyService(input: { companyId: number }) {
  await assertMon(input.companyId);
  return validateAgentOsConsistency(input.companyId);
}

export async function InvalidateCacheService(input: {
  companyId: number;
  resourceType?: string;
}) {
  await assertMon(input.companyId);
  await emitCacheInvalidation({
    companyId: input.companyId,
    event: "agentos_config_changed",
    resourceType: input.resourceType
  });
  return { ok: true };
}

export async function GetScalabilityConfigService(input: { companyId: number }) {
  await assertMon(input.companyId);
  return getScalabilityConfig();
}

export async function PutScalabilityConfigService(input: {
  companyId: number;
  patch: Record<string, unknown>;
}) {
  await assertMon(input.companyId);
  return setScalabilityConfig(input.patch as any);
}

export async function ClaimIdempotencyAdminService(input: {
  companyId: number;
  key: string;
  operationType: string;
  payload: unknown;
}) {
  await assertMon(input.companyId);
  const provider = getAgentOsIdempotencyProvider();
  return provider.claim({
    companyId: input.companyId,
    key: input.key,
    operationType: input.operationType,
    requestHash: hashRequestPayload(input.payload),
    ownerId: newLockOwnerToken(),
    ttlMs: getScalabilityConfig().idempotencyTtlMs,
    processingTimeoutMs: getScalabilityConfig().idempotencyProcessingTimeoutMs
  });
}

export async function GetDistributedMetricsService(input: {
  companyId: number;
  component?: string;
}) {
  await assertMon(input.companyId);
  return readMetricBuckets({
    companyId: input.companyId,
    component: input.component
  });
}

export async function StartupRecoveryService() {
  if (!getScalabilityConfig().startupRecoveryEnabled) {
    return { skipped: true };
  }
  await beatAgentOsWorker("online");
  await scheduleDefaultAgentOsJobs();
  return { ok: true, worker: true };
}

export { useInMemoryAgentOsProviders, processAgentOsJob };
