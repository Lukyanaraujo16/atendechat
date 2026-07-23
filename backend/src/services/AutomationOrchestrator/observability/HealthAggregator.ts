import {
  AgentOsHealthReport,
  AgentOsComponentHealth
} from "./types";
import { AgentOsHealthStatus } from "../../../config/automationAgentOsObservabilityConstants";
import { getObservabilityMetrics } from "./ObservabilityMetricsStore";
import { listAgentOsAlerts } from "./AlertEngine";
import { getAgentOsPersistenceBackend } from "../persistence/persistenceUtils";
import { getObservabilityConfig } from "./ObservabilityConfig";

function worst(
  statuses: AgentOsHealthStatus[]
): AgentOsHealthStatus {
  if (statuses.includes("Critical")) return "Critical";
  if (statuses.includes("Degraded")) return "Degraded";
  if (statuses.includes("Unknown")) return "Unknown";
  return "Healthy";
}

function component(
  name: string,
  status: AgentOsHealthStatus,
  message?: string
): AgentOsComponentHealth {
  return {
    component: name,
    status,
    message,
    checkedAt: new Date().toISOString()
  };
}

export function buildAgentOsHealth(companyId: number): AgentOsHealthReport {
  const cfg = getObservabilityConfig();
  const metrics = getObservabilityMetrics(companyId);
  const alerts = listAgentOsAlerts(companyId, { unacknowledgedOnly: true, limit: 50 });
  const criticalAlerts = alerts.filter(a => a.severity === "critical").length;
  const warnAlerts = alerts.filter(a => a.severity === "warn" || a.severity === "error").length;

  const persistenceBackend = getAgentOsPersistenceBackend();
  const persistenceStatus: AgentOsHealthStatus =
    persistenceBackend === "sequelize"
      ? "Healthy"
      : persistenceBackend === "memory"
        ? "Degraded"
        : "Unknown";

  const latencyStatus: AgentOsHealthStatus =
    metrics.p95Latency >= cfg.latencyCriticalMs
      ? "Critical"
      : metrics.p95Latency >= cfg.latencyWarnMs
        ? "Degraded"
        : "Healthy";

  const failureStatus: AgentOsHealthStatus =
    metrics.failureRate >= 0.35
      ? "Critical"
      : metrics.failureRate >= 0.15
        ? "Degraded"
        : "Healthy";

  const alertStatus: AgentOsHealthStatus =
    criticalAlerts > 0 ? "Critical" : warnAlerts > 0 ? "Degraded" : "Healthy";

  const components: AgentOsComponentHealth[] = [
    component("Planner", latencyStatus, `p95=${metrics.p95Latency}ms`),
    component("Runtime", failureStatus, `failureRate=${metrics.failureRate}`),
    component(
      "MCP",
      (metrics.byOrigin.mcp?.failures || 0) > 5 ? "Degraded" : "Healthy"
    ),
    component("Memory", "Healthy"),
    component("Learning", "Healthy"),
    component(
      "Persistence",
      persistenceStatus,
      `backend=${persistenceBackend}`
    ),
    component("Queue", "Unknown", "use /automation/scalability/health for probe"),
    component("Metrics", "Healthy"),
    component("Replay", "Healthy"),
    component("Alerts", alertStatus, `open=${alerts.length}`)
  ];

  return {
    status: worst(components.map(c => c.status)),
    checkedAt: new Date().toISOString(),
    companyId,
    components
  };
}

/** Health Wave 4 — inclui probes reais (DB/Redis/Queue). */
export async function buildAgentOsHealthAsync(
  companyId: number
): Promise<AgentOsHealthReport & { scalability?: unknown }> {
  const base = buildAgentOsHealth(companyId);
  try {
    const { buildScalabilityHealth } = await import(
      "../scalability/HealthProbes"
    );
    const scale = await buildScalabilityHealth(companyId);
    const merged = [...base.components];
    for (const c of scale.components) {
      merged.push({
        component: c.component,
        status: c.status,
        message: c.message,
        checkedAt: c.checkedAt
      });
    }
    return {
      ...base,
      status: worst(merged.map(m => m.status)),
      components: merged,
      scalability: scale
    };
  } catch {
    return base;
  }
}
