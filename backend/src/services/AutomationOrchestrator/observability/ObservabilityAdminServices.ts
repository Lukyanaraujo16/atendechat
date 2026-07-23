import { buildAgentOsHealth, buildAgentOsHealthAsync } from "./HealthAggregator";
import { getObservabilityMetrics, listRecentLatencies } from "./ObservabilityMetricsStore";
import { listAgentOsEvents } from "./AgentOsEventBus";
import { listTimelines, getTimelinePersistent } from "./TimelineBuilder";
import { listAgentOsAlerts, acknowledgeAlert } from "./AlertEngine";
import { rebuildExecutionFromPersistence } from "./PersistentReplayService";
import { exportObservability } from "./ExportService";
import { runObservabilityOps } from "./ObservabilityOps";
import {
  getObservabilityConfig,
  setObservabilityConfig
} from "./ObservabilityConfig";
import { observeAgentOsStep } from "./observeAgentOsStep";
import { createTraceContext } from "./types";
import { assertAgentOsPlanFeature } from "../security/AgentOsPlanGate";
import { AGENTOS_FEATURE_KEYS } from "../../../config/automationAgentOsSecurityConstants";

async function assertObsPlan(companyId: number) {
  await assertAgentOsPlanFeature(companyId, AGENTOS_FEATURE_KEYS.monitor);
}

export async function GetObservabilityDashboardService(input: {
  companyId: number;
}) {
  await assertObsPlan(input.companyId);
  const health = buildAgentOsHealth(input.companyId);
  const metrics = getObservabilityMetrics(input.companyId);
  const timelines = listTimelines(input.companyId, 20);
  const inProgress = timelines.filter(t => !t.endedAt);
  const recent = timelines.filter(t => t.endedAt).slice(0, 20);
  const failures = listAgentOsEvents(input.companyId, { limit: 100 }).filter(
    e => e.severity === "error" || e.severity === "critical"
  );
  const alerts = listAgentOsAlerts(input.companyId, {
    unacknowledgedOnly: true,
    limit: 50
  });

  return {
    health,
    metrics,
    inProgressExecutions: inProgress,
    recentExecutions: recent,
    failures: failures.slice(0, 30),
    latency: {
      average: metrics.averageLatency,
      p95: metrics.p95Latency,
      p99: metrics.p99Latency,
      recent: listRecentLatencies(input.companyId, 30)
    },
    topErrors: metrics.topErrors,
    topTools: metrics.topTools,
    topMcp: metrics.topMcp,
    usageByAgent: metrics.byAgent,
    usageByTenant: { [String(input.companyId)]: metrics.throughput },
    usageByPlan: { note: "derivado do plano efetivo do tenant" },
    alerts,
    config: getObservabilityConfig()
  };
}

export async function GetObservabilityHealthService(input: { companyId: number }) {
  await assertObsPlan(input.companyId);
  return buildAgentOsHealthAsync(input.companyId);
}

export async function GetObservabilityMetricsService(input: { companyId: number }) {
  await assertObsPlan(input.companyId);
  return getObservabilityMetrics(input.companyId);
}

export async function GetObservabilityTraceService(input: {
  companyId: number;
  traceId: string;
}) {
  await assertObsPlan(input.companyId);
  return rebuildExecutionFromPersistence({
    companyId: input.companyId,
    traceId: input.traceId
  });
}

export async function GetObservabilityTimelineService(input: {
  companyId: number;
  traceId: string;
}) {
  await assertObsPlan(input.companyId);
  return getTimelinePersistent(input.companyId, input.traceId);
}

export async function ListObservabilityEventsService(input: {
  companyId: number;
  traceId?: string;
  limit?: number;
}) {
  await assertObsPlan(input.companyId);
  return listAgentOsEvents(input.companyId, {
    traceId: input.traceId,
    limit: input.limit
  });
}

export async function ListObservabilityAlertsService(input: {
  companyId: number;
}) {
  await assertObsPlan(input.companyId);
  return listAgentOsAlerts(input.companyId, { limit: 100 });
}

export async function AcknowledgeObservabilityAlertService(input: {
  companyId: number;
  alertId: string;
}) {
  await assertObsPlan(input.companyId);
  return { ok: acknowledgeAlert(input.companyId, input.alertId) };
}

export async function ExportObservabilityService(input: {
  companyId: number;
  kind: "replay" | "audit" | "metrics" | "timeline" | "events" | "alerts";
  format: "json" | "csv";
  traceId?: string;
}) {
  await assertObsPlan(input.companyId);
  return exportObservability(input);
}

export async function RunObservabilityOperationService(input: {
  companyId: number;
  userId?: number | null;
  operation:
    | "reprocess_replay"
    | "recalculate_metrics"
    | "reindex_documents"
    | "validate_consistency"
    | "health_check";
  traceId?: string;
}) {
  await assertObsPlan(input.companyId);
  return runObservabilityOps(input);
}

export async function GetObservabilityConfigService(input: { companyId: number }) {
  await assertObsPlan(input.companyId);
  return getObservabilityConfig();
}

export async function PutObservabilityConfigService(input: {
  companyId: number;
  patch: Record<string, unknown>;
}) {
  await assertObsPlan(input.companyId);
  return setObservabilityConfig(input.patch as any);
}

/** Seed/demo observation for tester — não altera produção cognitiva. */
export async function SimulateObservabilityProbeService(input: {
  companyId: number;
  agentId?: string | null;
}) {
  await assertObsPlan(input.companyId);
  const ctx = createTraceContext({
    companyId: input.companyId,
    agentId: input.agentId
  });
  observeAgentOsStep({
    companyId: input.companyId,
    origin: "api",
    type: "observability.probe",
    latencyMs: 12,
    success: true,
    agentId: input.agentId,
    sessionId: ctx.sessionId,
    executionId: ctx.executionId,
    traceId: ctx.traceId,
    correlationId: ctx.correlationId,
    finish: true
  });
  return { ok: true, traceId: ctx.traceId };
}
