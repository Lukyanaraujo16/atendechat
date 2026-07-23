import { CanaryHealth } from "../../../config/automationAgentOsProductionConstants";
import { getObservabilityMetrics } from "../observability/ObservabilityMetricsStore";
import { listAgentOsAlerts } from "../observability/AlertEngine";
import { getQueueHealthProbe } from "../scalability/HealthProbes";
import { loadRolloutConfig } from "./RolloutStateMachine";
import { emitAgentOsEvent } from "../observability/AgentOsEventBus";
import { createTraceContext } from "../observability/types";

export async function evaluateCanary(companyId: number): Promise<{
  health: CanaryHealth;
  reasonCodes: string[];
  metrics: Record<string, unknown>;
}> {
  const cfg = await loadRolloutConfig(companyId);
  const metrics = getObservabilityMetrics(companyId);
  const alerts = listAgentOsAlerts(companyId, {
    unacknowledgedOnly: true,
    limit: 50
  });
  const qh = await getQueueHealthProbe();
  const reasonCodes: string[] = [];

  if (metrics.throughput < 5) {
    return {
      health: "INSUFFICIENT_DATA",
      reasonCodes: ["INSUFFICIENT_EXECUTIONS"],
      metrics: { throughput: metrics.throughput }
    };
  }

  if (metrics.failureRate >= 0.25) reasonCodes.push("HIGH_FAILURE_RATE");
  if (metrics.p95Latency >= 5000) reasonCodes.push("HIGH_P95");
  if (metrics.timeouts > 10) reasonCodes.push("HIGH_TIMEOUTS");
  if (alerts.some(a => a.severity === "critical"))
    reasonCodes.push("CRITICAL_ALERT");
  if (qh.status === "Critical") reasonCodes.push("QUEUE_CRITICAL");

  let health: CanaryHealth = "HEALTHY";
  if (reasonCodes.includes("CRITICAL_ALERT") || reasonCodes.includes("QUEUE_CRITICAL")) {
    health = "UNHEALTHY";
  } else if (reasonCodes.length) {
    health = "WARNING";
  }

  const ctx = createTraceContext({ companyId });
  if (health === "WARNING") {
    emitAgentOsEvent({
      ctx,
      type: "CANARY_WARNING",
      origin: "ops",
      severity: "warn",
      payload: { reasonCodes }
    });
  }
  if (health === "UNHEALTHY") {
    emitAgentOsEvent({
      ctx,
      type: "CANARY_UNHEALTHY",
      origin: "ops",
      severity: "critical",
      payload: { reasonCodes }
    });
    if (cfg.autoRollbackEnabled && cfg.flags.autoRollbackEnabled) {
      const { triggerAutoRollback } = await import("./AutoRollback");
      await triggerAutoRollback({
        companyId,
        reasonCodes,
        source: "canary"
      });
    }
  }

  return {
    health,
    reasonCodes,
    metrics: {
      successRate: metrics.successRate,
      failureRate: metrics.failureRate,
      p95: metrics.p95Latency,
      p99: metrics.p99Latency,
      timeouts: metrics.timeouts,
      rateLimitHits: metrics.rateLimitHits,
      queueStatus: qh.status,
      canarySamplingRate: cfg.canarySamplingRate
    }
  };
}
