/**
 * Fase IA 2.2.1 — Hardening Live
 * Stress / Concurrency / Chaos / Circuit / Guards / Snapshot / Metrics
 */
import { buildExecutionPolicySnapshot } from "../ExecutionPolicySnapshot";
import {
  __resetDistributedCircuitForTests,
  getCircuitState,
  isCircuitBlocking,
  recordCircuitFailure,
  recordCircuitSuccess
} from "../DistributedCircuitBreaker";
import {
  __resetDistributedRateLimitForTests,
  checkDistributedRateLimit
} from "../DistributedRateLimiter";
import {
  __resetDistributedMetricsForTests,
  getDistributedMetricsSnapshot,
  getGuardTimestamp,
  recordDistributedLatency,
  recordDistributedMetric,
  setGuardTimestamp
} from "../DistributedMetricsStore";
import {
  canApplyRollback,
  canPromoteRollout,
  markRollbackApplied
} from "../RolloutGuards";
import {
  __resetFailureAggregatorForTests,
  getFailureAggregates,
  recordFailureAggregate
} from "../FailureAggregator";
import {
  __resetSampleWindowForTests,
  getSampleWindowStats,
  pushSample
} from "../SampleWindowEngine";
import {
  __resetAlertsForTests,
  evaluateProductionAlerts,
  emitProductionAlert,
  listRecentAlerts
} from "../ProductionAlerts";
import { DEFAULT_LIVE_ROLLOUT_CONFIG } from "../../../../../config/automationLiveRolloutConstants";
import { DEFAULT_LIVE_HARDENING_CONFIG } from "../../../../../config/automationLiveHardeningConstants";
import {
  __resetLiveRolloutMetricsForTests,
  recordLiveFcExecution
} from "../../LiveRolloutMetrics";
import { __resetEvidenceMetricsForTests } from "../../../evidence/EvidenceMetrics";

function fakeEligibility(over: Record<string, unknown> = {}) {
  return {
    eligible: true,
    stage: "CANARY",
    percent: 10,
    effectivePercent: 10,
    canaryBucket: 3,
    reasons: ["ok"],
    blockers: [],
    gates: {
      stage: true,
      company: true,
      agent: true,
      connection: true,
      canary: true,
      message: true,
      killSwitch: true,
      readiness: true
    },
    killSwitch: { active: false },
    readinessLevel: "ready",
    readinessScore: 0.9,
    ...over
  } as any;
}

describe("Live Hardening 2.2.1", () => {
  beforeEach(() => {
    __resetDistributedCircuitForTests();
    __resetDistributedRateLimitForTests();
    __resetDistributedMetricsForTests();
    __resetFailureAggregatorForTests();
    __resetSampleWindowForTests();
    __resetAlertsForTests();
    __resetLiveRolloutMetricsForTests();
    __resetEvidenceMetricsForTests();
  });

  it("ExecutionPolicySnapshot é imutável e Write Tools OFF", () => {
    const snap = buildExecutionPolicySnapshot({
      executionId: "abc123",
      companyId: 1,
      ticketId: 10,
      connectionId: 2,
      agentId: 3,
      provider: "openai",
      eligibility: fakeEligibility(),
      config: DEFAULT_LIVE_ROLLOUT_CONFIG,
      featureFlags: { liveFc: true, writeTools: false },
      availableTools: ["lookup_ticket"]
    });

    expect(snap.allowWriteToolsLive).toBe(false);
    expect(snap.allowedRisk).toBe("read_only");
    expect(snap.executionId).toBe("abc123");
    expect(snap.rolloutPercent).toBe(10);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.eligibility)).toBe(true);
    expect(Object.isFrozen(snap.eligibility.blockers)).toBe(true);
  });

  it("Distributed Metrics persistem contadores", async () => {
    await recordDistributedMetric({ companyId: 9, field: "fallbacks", n: 2 });
    await recordDistributedMetric({ companyId: 9, field: "timeouts" });
    await recordDistributedLatency(9, 500);
    await recordDistributedLatency(9, 700);
    const snap = await getDistributedMetricsSnapshot(9);
    expect(snap.fallbacks).toBe(2);
    expect(snap.timeouts).toBe(1);
    expect(snap.averageLatency).toBe(600);
  });

  it("Circuit Breaker abre após limiar e bloqueia", async () => {
    const scope = { scope: "company" as const, id: "77" };
    const threshold = DEFAULT_LIVE_HARDENING_CONFIG.circuitBreaker.failureThreshold;
    for (let i = 0; i < threshold; i++) {
      await recordCircuitFailure(scope);
    }
    const st = await getCircuitState(scope);
    expect(st.state).toBe("Open");
    expect(await isCircuitBlocking(scope)).toBe(true);
  });

  it("Circuit Breaker permanece Open após limiar até TTL", async () => {
    const scope = { scope: "provider" as const, id: "openai" };
    const threshold = DEFAULT_LIVE_HARDENING_CONFIG.circuitBreaker.failureThreshold;
    for (let i = 0; i < threshold; i++) {
      await recordCircuitFailure(scope);
    }
    expect((await getCircuitState(scope)).state).toBe("Open");
    // sucesso enquanto Open não fecha imediatamente
    await recordCircuitSuccess(scope);
    expect((await getCircuitState(scope)).state).toBe("Open");
  });

  it("Rate Limiter bloqueia acima do limiar (memória)", async () => {
    const limit = DEFAULT_LIVE_HARDENING_CONFIG.rateLimit.toolPerMinute;
    let blocked = false;
    for (let i = 0; i < limit + 5; i++) {
      const r = await checkDistributedRateLimit({
        scope: "tool",
        companyId: 1,
        id: "lookup"
      });
      if (!r.allowed) {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
  });

  it("Rollback Guard aplica cooldown", async () => {
    const companyId = 42;
    const first = await canApplyRollback(companyId);
    expect(first.allowed).toBe(true);
    await markRollbackApplied(companyId);
    const second = await canApplyRollback(companyId);
    expect(second.allowed).toBe(false);
    expect(second.reason).toBe("rollback_cooldown");
  });

  it("Promotion Guard exige execuções mínimas", async () => {
    const r = await canPromoteRollout(99);
    expect(r.allowed).toBe(false);
    expect(r.blockers.some(b => b.startsWith("min_executions"))).toBe(true);
  });

  it("Failure Aggregator consolida dimensões", async () => {
    await recordFailureAggregate({
      companyId: 5,
      dimension: "provider",
      id: "openai",
      kind: "timeout"
    });
    await recordFailureAggregate({
      companyId: 5,
      dimension: "provider",
      id: "openai",
      kind: "timeout"
    });
    await recordFailureAggregate({
      companyId: 5,
      dimension: "agent",
      id: 7,
      kind: "fc_failure"
    });
    const providers = await getFailureAggregates({
      companyId: 5,
      dimension: "provider"
    });
    expect(providers[0].count).toBe(2);
    expect(providers[0].id).toBe("openai");
  });

  it("Sample Window e Alerts", async () => {
    await pushSample({ companyId: 3, metric: "latency", value: 100 });
    await pushSample({ companyId: 3, metric: "latency", value: 200 });
    const stats = await getSampleWindowStats({
      companyId: 3,
      metric: "latency"
    });
    expect(stats.count).toBe(2);
    expect(stats.sum).toBe(300);

    emitProductionAlert({
      companyId: 3,
      kind: "rollback",
      message: "test"
    });
    expect(listRecentAlerts(3).length).toBe(1);

    recordLiveFcExecution({
      companyId: 3,
      provider: "openai",
      stage: "CANARY",
      fallback: true,
      latencyMs: 20_000,
      tokens: 10
    });
    // force high latency alert via distributed
    await recordDistributedLatency(3, 15_000);
    const alerts = await evaluateProductionAlerts(3);
    expect(alerts.some(a => a.code === "HIGH_LATENCY")).toBe(true);
  });

  it("Concurrency stress — métricas e rate limit em paralelo", async () => {
    const companyId = 88;
    await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        recordDistributedMetric({
          companyId,
          field: i % 2 === 0 ? "fallbacks" : "timeouts"
        })
      )
    );
    const snap = await getDistributedMetricsSnapshot(companyId);
    expect((snap.fallbacks || 0) + (snap.timeouts || 0)).toBe(40);

    const limit = DEFAULT_LIVE_HARDENING_CONFIG.rateLimit.toolPerMinute;
    const results = await Promise.all(
      Array.from({ length: limit + 20 }, () =>
        checkDistributedRateLimit({
          scope: "tool",
          companyId,
          id: "stress-tool"
        })
      )
    );
    expect(results.some(r => r.allowed)).toBe(true);
    expect(results.some(r => !r.allowed)).toBe(true);
  });

  it("Chaos — falhas consecutivas abrem circuit e agregam", async () => {
    const companyId = 55;
    const scope = { scope: "company" as const, id: String(companyId) };
    const threshold = DEFAULT_LIVE_HARDENING_CONFIG.circuitBreaker.failureThreshold;
    for (let i = 0; i < threshold + 2; i++) {
      await recordCircuitFailure(scope);
      await recordFailureAggregate({
        companyId,
        dimension: "company",
        id: companyId,
        kind: "chaos"
      });
      await recordDistributedMetric({
        companyId,
        field: "providerFailures"
      });
    }
    expect(await isCircuitBlocking(scope)).toBe(true);
    const agg = await getFailureAggregates({
      companyId,
      dimension: "company"
    });
    expect(agg[0].count).toBeGreaterThanOrEqual(threshold);
  });

  it("Guard timestamps dual-write memória", async () => {
    await setGuardTimestamp("test:guard:1", 60);
    const ts = await getGuardTimestamp("test:guard:1");
    expect(ts).not.toBeNull();
    expect(typeof ts).toBe("number");
  });
});
