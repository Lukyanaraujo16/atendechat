import {
  useInMemoryAgentOsProviders,
  resetAgentOsProviders,
  getAgentOsCacheProvider,
  getAgentOsLockProvider,
  getAgentOsRateLimitProvider,
  getAgentOsIdempotencyProvider,
  getAgentOsQueueProvider
} from "../providers";
import { hashRequestPayload, InMemoryQueueProvider } from "../providers/InMemoryProviders";
import { withDistributedLock, tenantCacheKey, cacheSetJson, cacheGetJson, invalidateTenantCache } from "../CacheAndLocks";
import { assertOptimisticVersion, nextVersion } from "../OptimisticLock";
import { clampPageLimit, paginateByCreatedAtId } from "../Pagination";
import { classifyAgentOsError, isRetryable, computeBackoffMs } from "../RetryPolicy";
import { circuitAllow, circuitFailure, circuitSuccess, getCircuitState } from "../CircuitBreaker";
import { recordDistributedMetric, readMetricBuckets } from "../DistributedMetrics";
import { getQueueHealthProbe, buildScalabilityHealth } from "../HealthProbes";
import { validateAgentOsConsistency } from "../ConsistencyValidator";
import { enqueueAgentOsJob } from "../JobRunner";
import { beatAgentOsWorker } from "../WorkerRegistry";
import { resetScalabilityConfig, getScalabilityConfig } from "../ScalabilityConfig";
import { ERR_AGENTOS_CONCURRENT_MODIFICATION } from "../../../../config/automationAgentOsScalabilityConstants";
import AppError from "../../../../errors/AppError";
import { newLockOwnerToken } from "../providers/RedisProviders";

describe("AgentOS Scalability Wave 4", () => {
  beforeEach(() => {
    resetScalabilityConfig();
    useInMemoryAgentOsProviders();
  });

  afterEach(() => {
    resetAgentOsProviders();
  });

  it("uses tenant-scoped cache keys and invalidation", async () => {
    const key = tenantCacheKey(1, "profile", "a1", 2);
    expect(key).toContain("co:1");
    expect(key).toContain("rt:profile");
    await cacheSetJson(key, { ok: true }, 5000);
    expect(await cacheGetJson(key)).toEqual({ ok: true });
    await invalidateTenantCache(1, "profile");
    expect(await cacheGetJson(key)).toBeNull();
  });

  it("acquires and releases distributed locks", async () => {
    const lock = getAgentOsLockProvider();
    const owner = newLockOwnerToken();
    const a = await lock.acquire("co:1:test:x", owner, 5000);
    expect(a.acquired).toBe(true);
    const b = await lock.acquire("co:1:test:x", newLockOwnerToken(), 5000);
    expect(b.acquired).toBe(false);
    expect(await lock.release("co:1:test:x", owner)).toBe(true);
  });

  it("withDistributedLock serializes critical section", async () => {
    let n = 0;
    await withDistributedLock({
      companyId: 1,
      resource: "sess",
      resourceId: "s1",
      fn: async () => {
        n += 1;
        return n;
      }
    });
    expect(n).toBe(1);
  });

  it("idempotency claim / replay / payload conflict", async () => {
    const idem = getAgentOsIdempotencyProvider();
    const owner = newLockOwnerToken();
    const hash = hashRequestPayload({ a: 1 });
    const first = await idem.claim({
      companyId: 9,
      key: "k1",
      operationType: "write",
      requestHash: hash,
      ownerId: owner,
      ttlMs: 60_000,
      processingTimeoutMs: 30_000
    });
    expect(first.outcome).toBe("acquired");
    await idem.complete({
      companyId: 9,
      key: "k1",
      resultReference: "ref-1",
      ownerId: owner
    });
    const replay = await idem.claim({
      companyId: 9,
      key: "k1",
      operationType: "write",
      requestHash: hash,
      ownerId: newLockOwnerToken(),
      ttlMs: 60_000,
      processingTimeoutMs: 30_000
    });
    expect(replay.outcome).toBe("replay");
    const conflict = await idem.claim({
      companyId: 9,
      key: "k1",
      operationType: "write",
      requestHash: hashRequestPayload({ a: 2 }),
      ownerId: newLockOwnerToken(),
      ttlMs: 60_000,
      processingTimeoutMs: 30_000
    });
    expect(conflict.outcome).toBe("conflict_payload");
  });

  it("rate limit provider enforces max", async () => {
    const rl = getAgentOsRateLimitProvider();
    let blocked = false;
    for (let i = 0; i < 5; i += 1) {
      const r = await rl.take({
        scope: "t",
        key: "u1",
        windowMs: 60_000,
        max: 3
      });
      if (!r.allowed) blocked = true;
    }
    expect(blocked).toBe(true);
  });

  it("queue enqueue dedup + dead letter", async () => {
    const q = getAgentOsQueueProvider() as InMemoryQueueProvider;
    const j1 = await q.enqueue({
      type: "retention_cleanup",
      companyId: 1,
      payload: {},
      deduplicationKey: "d1"
    });
    const j2 = await q.enqueue({
      type: "retention_cleanup",
      companyId: 1,
      payload: {},
      deduplicationKey: "d1"
    });
    expect(j1.jobId).toBe(j2.jobId);
    await q.markDeadLetter(j1.jobId, "ERR");
    const listed = await q.listJobs({ status: "DEAD_LETTER" });
    expect(listed.length).toBe(1);
  });

  it("retry policy classifies errors", () => {
    expect(classifyAgentOsError(new Error("ERR_NO_PERMISSION"))).toBe(
      "AUTHORIZATION"
    );
    expect(isRetryable("VALIDATION")).toBe(false);
    expect(isRetryable("TIMEOUT")).toBe(true);
    expect(computeBackoffMs(1)).toBeGreaterThan(0);
  });

  it("optimistic locking conflict", () => {
    expect(() => assertOptimisticVersion(1, 2)).toThrow(AppError);
    try {
      assertOptimisticVersion(1, 2);
    } catch (e) {
      expect((e as AppError).message).toBe(ERR_AGENTOS_CONCURRENT_MODIFICATION);
    }
    expect(nextVersion(3)).toBe(4);
  });

  it("pagination clamps and cursors", () => {
    expect(clampPageLimit(9999)).toBe(getScalabilityConfig().maxPageLimit);
    const items = Array.from({ length: 5 }).map((_, i) => ({
      id: `i${i}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString()
    }));
    const page = paginateByCreatedAtId(items, { limit: 2 });
    expect(page.items.length).toBe(2);
    expect(page.nextCursor).toBeTruthy();
  });

  it("circuit breaker opens after failures", async () => {
    const scope = "ext:test";
    expect(await circuitAllow(scope)).toBe(true);
    for (let i = 0; i < getScalabilityConfig().circuitBreakerFailureThreshold; i += 1) {
      await circuitFailure(scope, "ERR");
    }
    const st = await getCircuitState(scope);
    expect(st.state).toBe("OPEN");
    expect(await circuitAllow(scope)).toBe(false);
    await circuitSuccess(scope);
    expect((await getCircuitState(scope)).state).toBe("CLOSED");
  });

  it("distributed metrics buckets", async () => {
    await recordDistributedMetric({
      companyId: 3,
      component: "runtime",
      operation: "exec",
      status: "success",
      latencyMs: 40
    });
    const snap = await readMetricBuckets({
      companyId: 3,
      component: "runtime"
    });
    expect(snap.count).toBeGreaterThan(0);
    expect(snap.dataFreshness).toBe("eventual");
  });

  it("queue health and workers", async () => {
    await beatAgentOsWorker("online");
    await enqueueAgentOsJob({
      type: "metrics_aggregation",
      companyId: 1,
      payload: {}
    });
    const qh = await getQueueHealthProbe();
    expect(["Healthy", "Degraded", "Critical", "Unknown"]).toContain(qh.status);
    const health = await buildScalabilityHealth(1);
    expect(health.liveIntegrationAllowed).toBe(false);
    expect(health.components.length).toBeGreaterThan(3);
  });

  it("consistency validator returns findings array", async () => {
    const r = await validateAgentOsConsistency(1);
    expect(Array.isArray(r.findings)).toBe(true);
  });

  it("preserves live disabled and no cognitive change flags", () => {
    expect(getScalabilityConfig().liveIntegrationAllowed).toBe(false);
  });

  it("simulates concurrent lock contention", async () => {
    const lock = getAgentOsLockProvider();
    const o1 = newLockOwnerToken();
    await lock.acquire("co:7:agent:1", o1, 5000);
    const r = await Promise.all([
      lock.acquire("co:7:agent:1", newLockOwnerToken(), 5000),
      lock.acquire("co:7:agent:1", newLockOwnerToken(), 5000)
    ]);
    expect(r.every(x => x.acquired === false)).toBe(true);
    await lock.release("co:7:agent:1", o1);
  });

  it("idempotency in_progress while locked", async () => {
    const idem = getAgentOsIdempotencyProvider();
    const owner = newLockOwnerToken();
    const hash = hashRequestPayload({ x: 1 });
    await idem.claim({
      companyId: 2,
      key: "proc",
      operationType: "op",
      requestHash: hash,
      ownerId: owner,
      ttlMs: 60_000,
      processingTimeoutMs: 60_000
    });
    const second = await idem.claim({
      companyId: 2,
      key: "proc",
      operationType: "op",
      requestHash: hash,
      ownerId: newLockOwnerToken(),
      ttlMs: 60_000,
      processingTimeoutMs: 60_000
    });
    expect(second.outcome).toBe("in_progress");
  });
});
