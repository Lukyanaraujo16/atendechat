import {
  AgentOsAggregatedMetrics,
  AgentOsLatencySample,
  emptyAggregatedMetrics,
  percentile
} from "./types";
import { AgentOsOrigin } from "../../../config/automationAgentOsObservabilityConstants";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { AGENTOS_OBSERVABILITY_MODULE_KEY } from "../../../config/automationAgentOsObservabilityConstants";
import { getObservabilityConfig } from "./ObservabilityConfig";

const metricsByCompany = new Map<number, AgentOsAggregatedMetrics>();
const latencyRing: AgentOsLatencySample[] = [];

function get(companyId: number): AgentOsAggregatedMetrics {
  let m = metricsByCompany.get(companyId);
  if (!m) {
    m = emptyAggregatedMetrics();
    metricsByCompany.set(companyId, m);
  }
  return m;
}

function bumpOrigin(
  m: AgentOsAggregatedMetrics,
  origin: AgentOsOrigin,
  latencyMs: number,
  failed: boolean
): void {
  const cur = m.byOrigin[origin] || { count: 0, latencySum: 0, failures: 0 };
  cur.count += 1;
  cur.latencySum += latencyMs;
  if (failed) cur.failures += 1;
  m.byOrigin[origin] = cur;
}

export function recordLatency(input: {
  companyId: number;
  origin: AgentOsOrigin;
  latencyMs: number;
  success?: boolean;
  traceId?: string;
  agentId?: string | null;
  errorCode?: string | null;
  toolId?: string | null;
  mcpServerId?: string | null;
  retry?: boolean;
  fallback?: boolean;
  timeout?: boolean;
  rateLimited?: boolean;
}): void {
  const cfg = getObservabilityConfig();
  if (!cfg.enabled) return;
  const ms = Math.max(0, input.latencyMs || 0);
  const m = get(input.companyId);
  const failed = input.success === false;
  if (failed) m.failureCount += 1;
  else m.successCount += 1;
  m.latencySum += ms;
  m.latencySamples.push(ms);
  if (m.latencySamples.length > 2_000) m.latencySamples.shift();
  m.throughput += 1;
  if (input.retry) m.retries += 1;
  if (input.fallback) m.fallbacks += 1;
  if (input.timeout) m.timeouts += 1;
  if (input.rateLimited) m.rateLimitHits += 1;
  bumpOrigin(m, input.origin, ms, failed);
  if (input.errorCode) {
    m.topErrors[input.errorCode] = (m.topErrors[input.errorCode] || 0) + 1;
  }
  if (input.toolId) {
    m.topTools[input.toolId] = (m.topTools[input.toolId] || 0) + 1;
  }
  if (input.mcpServerId) {
    m.topMcp[input.mcpServerId] = (m.topMcp[input.mcpServerId] || 0) + 1;
  }
  if (input.agentId) {
    m.byAgent[input.agentId] = (m.byAgent[input.agentId] || 0) + 1;
  }

  latencyRing.push({
    origin: input.origin,
    companyId: input.companyId,
    latencyMs: ms,
    at: new Date().toISOString(),
    traceId: input.traceId
  });
  if (latencyRing.length > 5_000) latencyRing.shift();

  if (cfg.persistMetrics) {
    const periodStart = new Date();
    periodStart.setSeconds(0, 0);
    observabilityRepository.upsertMetricFireAndForget({
      companyId: input.companyId,
      moduleKey: AGENTOS_OBSERVABILITY_MODULE_KEY,
      metricKey: `latency.${input.origin}`,
      metricValue: ms,
      dimensions: {
        success: input.success !== false,
        agentId: input.agentId ?? null
      },
      periodStart
    });
  }
}

export function getObservabilityMetrics(companyId: number) {
  const m = get(companyId);
  const total = m.successCount + m.failureCount;
  const sorted = [...m.latencySamples].sort((a, b) => a - b);
  return {
    successRate: total ? Number((m.successCount / total).toFixed(4)) : 0,
    failureRate: total ? Number((m.failureCount / total).toFixed(4)) : 0,
    averageLatency: m.latencySamples.length
      ? Math.round(m.latencySum / m.latencySamples.length)
      : 0,
    p95Latency: percentile(sorted, 95),
    p99Latency: percentile(sorted, 99),
    throughput: m.throughput,
    executionsPerMin: m.throughput,
    retries: m.retries,
    fallbacks: m.fallbacks,
    timeouts: m.timeouts,
    rateLimitHits: m.rateLimitHits,
    byOrigin: { ...m.byOrigin },
    topErrors: Object.entries(m.topErrors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([code, count]) => ({ code, count })),
    topTools: Object.entries(m.topTools)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, count]) => ({ id, count })),
    topMcp: Object.entries(m.topMcp)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, count]) => ({ id, count })),
    byAgent: { ...m.byAgent },
    memoryUsedApprox: m.latencySamples.length
  };
}

export function listRecentLatencies(companyId: number, limit = 50) {
  return latencyRing
    .filter(s => s.companyId === companyId)
    .slice(-limit)
    .reverse();
}

export function resetObservabilityMetrics(companyId?: number): void {
  if (companyId == null) {
    metricsByCompany.clear();
    latencyRing.length = 0;
  } else {
    metricsByCompany.delete(companyId);
  }
}

export function recalculateObservabilityMetrics(companyId: number) {
  return getObservabilityMetrics(companyId);
}
