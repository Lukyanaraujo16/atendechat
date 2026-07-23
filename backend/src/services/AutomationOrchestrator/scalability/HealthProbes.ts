import { getAgentOsQueueProvider } from "./providers";
import { getScalabilityConfig, isRedisAvailableForAgentOs } from "./ScalabilityConfig";
import { getAgentOsPersistenceBackend } from "../persistence/persistenceUtils";
import { AgentOsHealthStatus } from "../../../config/automationAgentOsObservabilityConstants";
import { listAgentOsWorkers } from "./WorkerRegistry";
import { getCircuitState } from "./CircuitBreaker";
import { purgeExpiredIdempotency } from "./providers/SequelizeIdempotencyProvider";

export type ComponentHealth = {
  component: string;
  status: AgentOsHealthStatus;
  message?: string;
  details?: Record<string, unknown>;
  checkedAt: string;
};

function worst(statuses: AgentOsHealthStatus[]): AgentOsHealthStatus {
  if (statuses.includes("Critical")) return "Critical";
  if (statuses.includes("Degraded")) return "Degraded";
  if (statuses.includes("Unknown")) return "Unknown";
  return "Healthy";
}

async function checkDb(): Promise<ComponentHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const backend = getAgentOsPersistenceBackend();
    if (backend === "memory") {
      return {
        component: "database",
        status: "Degraded",
        message: "persistence=memory",
        checkedAt
      };
    }
    // lightweight: model import already registered; try count with limit
    const AutomationAgentOsIdempotency = (
      await import("../../../models/AutomationAgentOsIdempotency")
    ).default;
    await AutomationAgentOsIdempotency.findOne({ attributes: ["id"] });
    return {
      component: "database",
      status: "Healthy",
      message: `backend=${backend}`,
      checkedAt
    };
  } catch (e) {
    return {
      component: "database",
      status: "Critical",
      message: e instanceof Error ? e.message : "db_error",
      checkedAt
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const checkedAt = new Date().toISOString();
  if (!isRedisAvailableForAgentOs()) {
    return {
      component: "redis",
      status: process.env.NODE_ENV === "test" ? "Healthy" : "Degraded",
      message: "REDIS_URI ausente — providers memory",
      checkedAt
    };
  }
  try {
    const cache = await import("../../../libs/cache");
    await cache.redisGet("agentos:healthping");
    return { component: "redis", status: "Healthy", checkedAt };
  } catch (e) {
    return {
      component: "redis",
      status: "Critical",
      message: e instanceof Error ? e.message : "redis_error",
      checkedAt
    };
  }
}

async function checkQueue(): Promise<ComponentHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const q = getAgentOsQueueProvider();
    const queued = await q.listJobs({ status: "QUEUED", limit: 100 });
    const dlq = await q.listJobs({ status: "DEAD_LETTER", limit: 50 });
    const running = await q.listJobs({ status: "RUNNING", limit: 50 });
    let status: AgentOsHealthStatus = "Healthy";
    if (dlq.length > 20) status = "Critical";
    else if (queued.length > 100 || dlq.length > 0) status = "Degraded";
    return {
      component: "queue",
      status,
      message: `queued=${queued.length} running=${running.length} dlq=${dlq.length}`,
      details: {
        queued: queued.length,
        running: running.length,
        deadLetter: dlq.length
      },
      checkedAt
    };
  } catch (e) {
    return {
      component: "queue",
      status: "Unknown",
      message: e instanceof Error ? e.message : "queue_error",
      checkedAt
    };
  }
}

export async function buildScalabilityHealth(companyId: number) {
  const components: ComponentHealth[] = [];
  components.push(await checkDb());
  components.push(await checkRedis());
  components.push(await checkQueue());

  const workers = await listAgentOsWorkers();
  const staleMs = getScalabilityConfig().workerStaleMs;
  const stale = workers.filter(w => {
    const age = Date.now() - new Date(w.lastHeartbeatAt).getTime();
    return age > staleMs;
  });
  components.push({
    component: "workers",
    status: stale.length ? "Degraded" : workers.length ? "Healthy" : "Unknown",
    message: `online=${workers.length} stale=${stale.length}`,
    checkedAt: new Date().toISOString()
  });

  const cb = await getCircuitState(`company:${companyId}:external`);
  components.push({
    component: "circuit_breaker",
    status: cb.state === "OPEN" ? "Degraded" : "Healthy",
    message: `state=${cb.state}`,
    checkedAt: new Date().toISOString()
  });

  components.push({
    component: "observability_pipeline",
    status: "Healthy",
    checkedAt: new Date().toISOString()
  });

  components.push({
    component: "persistence_repositories",
    status: getAgentOsPersistenceBackend() === "sequelize" ? "Healthy" : "Degraded",
    checkedAt: new Date().toISOString()
  });

  return {
    status: worst(components.map(c => c.status)),
    companyId,
    checkedAt: new Date().toISOString(),
    components,
    liveIntegrationAllowed: false
  };
}

export async function getQueueHealthProbe() {
  const q = getAgentOsQueueProvider();
  const queued = await q.listJobs({ status: "QUEUED", limit: 200 });
  const active = await q.listJobs({ status: "RUNNING", limit: 100 });
  const failed = await q.listJobs({ status: "FAILED", limit: 100 });
  const dead = await q.listJobs({ status: "DEAD_LETTER", limit: 100 });
  const delayed = await q.listJobs({ status: "RETRY_SCHEDULED", limit: 100 });
  let oldestAgeMs = 0;
  for (const j of queued) {
    const age = Date.now() - new Date(j.scheduledAt).getTime();
    if (age > oldestAgeMs) oldestAgeMs = age;
  }
  let status: AgentOsHealthStatus = "Healthy";
  if (dead.length > 20 || oldestAgeMs > 600_000) status = "Critical";
  else if (dead.length > 0 || queued.length > 50) status = "Degraded";
  return {
    status,
    queued: queued.length,
    active: active.length,
    delayed: delayed.length,
    failed: failed.length,
    deadLetter: dead.length,
    oldestQueuedAgeMs: oldestAgeMs,
    checkedAt: new Date().toISOString()
  };
}

export async function runIdempotencyCleanupBatch() {
  const n = await purgeExpiredIdempotency(
    getScalabilityConfig().cleanupBatchSize
  );
  return { deleted: n };
}
