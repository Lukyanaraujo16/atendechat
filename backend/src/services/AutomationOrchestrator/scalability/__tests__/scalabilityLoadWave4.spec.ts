/**
 * Load tests reproduzíveis AgentOS Wave 4 (não apontam para produção).
 * Executar: npx jest scalabilityLoadWave4 --runInBand
 */
import {
  useInMemoryAgentOsProviders,
  resetAgentOsProviders,
  getAgentOsIdempotencyProvider,
  getAgentOsRateLimitProvider,
  getAgentOsLockProvider
} from "../providers";
import { hashRequestPayload } from "../providers/InMemoryProviders";
import { newLockOwnerToken } from "../providers/RedisProviders";
import { observeAgentOsStep } from "../../observability/observeAgentOsStep";
import { resetObservabilityMetrics, getObservabilityMetrics } from "../../observability/ObservabilityMetricsStore";
import { resetAgentOsEvents } from "../../observability/AgentOsEventBus";
import { resetTimelines } from "../../observability/TimelineBuilder";
import { resetScalabilityConfig } from "../ScalabilityConfig";

describe("AgentOS Wave 4 load baselines (in-memory)", () => {
  beforeEach(() => {
    resetScalabilityConfig();
    useInMemoryAgentOsProviders();
    resetObservabilityMetrics();
    resetAgentOsEvents();
    resetTimelines();
  });

  afterEach(() => {
    resetAgentOsProviders();
  });

  it("idempotency same-key burst yields single acquire", async () => {
    const idem = getAgentOsIdempotencyProvider();
    const hash = hashRequestPayload({ same: true });
    const results = await Promise.all(
      Array.from({ length: 50 }).map(() =>
        idem.claim({
          companyId: 1,
          key: "burst-same",
          operationType: "write",
          requestHash: hash,
          ownerId: newLockOwnerToken(),
          ttlMs: 60_000,
          processingTimeoutMs: 60_000
        })
      )
    );
    const acquired = results.filter(r => r.outcome === "acquired").length;
    const inProgress = results.filter(r => r.outcome === "in_progress").length;
    expect(acquired + inProgress).toBe(50);
    expect(acquired).toBe(1);
  });

  it("idempotency different-key burst all acquire", async () => {
    const idem = getAgentOsIdempotencyProvider();
    const results = await Promise.all(
      Array.from({ length: 40 }).map((_, i) =>
        idem.claim({
          companyId: 1,
          key: `burst-diff-${i}`,
          operationType: "write",
          requestHash: hashRequestPayload({ i }),
          ownerId: newLockOwnerToken(),
          ttlMs: 60_000,
          processingTimeoutMs: 60_000
        })
      )
    );
    expect(results.every(r => r.outcome === "acquired")).toBe(true);
  });

  it("observability ingestion throughput sample", () => {
    const t0 = Date.now();
    for (let i = 0; i < 200; i += 1) {
      observeAgentOsStep({
        companyId: 1,
        origin: "api",
        type: "load.sample",
        latencyMs: i % 50,
        success: i % 17 !== 0,
        finish: true
      });
    }
    const elapsed = Date.now() - t0;
    const m = getObservabilityMetrics(1);
    expect(m.throughput).toBe(200);
    expect(elapsed).toBeLessThan(5000);
  });

  it("rate limit under burst", async () => {
    const rl = getAgentOsRateLimitProvider();
    let denied = 0;
    for (let i = 0; i < 100; i += 1) {
      const r = await rl.take({
        scope: "load",
        key: "tenant:1",
        windowMs: 60_000,
        max: 25
      });
      if (!r.allowed) denied += 1;
    }
    expect(denied).toBeGreaterThan(50);
  });

  it("lock contention under parallel attempts", async () => {
    const lock = getAgentOsLockProvider();
    const owner = newLockOwnerToken();
    await lock.acquire("co:1:load:lock", owner, 5000);
    const attempts = await Promise.all(
      Array.from({ length: 30 }).map(() =>
        lock.acquire("co:1:load:lock", newLockOwnerToken(), 5000)
      )
    );
    expect(attempts.filter(a => a.acquired).length).toBe(0);
    await lock.release("co:1:load:lock", owner);
  });
});
