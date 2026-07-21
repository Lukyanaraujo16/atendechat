import { ToolRiskLevel, ToolSideEffectType, ToolInvocationSource } from "../../../config/automationToolConstants";

type ToolMetricsState = {
  toolExecutions: number;
  toolSuccesses: number;
  toolFailures: number;
  toolDenials: number;
  toolTimeouts: number;
  toolRetries: number;
  toolRollbacks: number;
  toolConfirmations: number;
  totalDurationMs: number;
  emptyResults: number;
  totalResultCount: number;
  cacheHits: number;
  cacheMisses: number;
  usageByTool: Record<string, number>;
  usageByVersion: Record<string, number>;
  usageBySource: Record<string, number>;
  usageByRisk: Record<string, number>;
  usageBySideEffect: Record<string, number>;
  latencyByTool: Record<string, { totalMs: number; count: number }>;
};

const byCompany = new Map<number, ToolMetricsState>();

function empty(): ToolMetricsState {
  return {
    toolExecutions: 0,
    toolSuccesses: 0,
    toolFailures: 0,
    toolDenials: 0,
    toolTimeouts: 0,
    toolRetries: 0,
    toolRollbacks: 0,
    toolConfirmations: 0,
    totalDurationMs: 0,
    emptyResults: 0,
    totalResultCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    usageByTool: {},
    usageByVersion: {},
    usageBySource: {},
    usageByRisk: {},
    usageBySideEffect: {},
    latencyByTool: {}
  };
}

function get(companyId: number): ToolMetricsState {
  let s = byCompany.get(companyId);
  if (!s) {
    s = empty();
    byCompany.set(companyId, s);
  }
  return s;
}

function inc(map: Record<string, number>, key: string, n = 1): void {
  map[key] = (map[key] || 0) + n;
}

export function recordToolMetric(input: {
  companyId: number;
  toolId: string;
  toolVersion: string;
  source: ToolInvocationSource | string;
  riskLevel: ToolRiskLevel | string;
  sideEffectType: ToolSideEffectType | string;
  status: string;
  durationMs: number;
  retries?: number;
  timedOut?: boolean;
  rolledBack?: boolean;
  confirmation?: boolean;
  resultCount?: number;
  emptyResult?: boolean;
  cacheHit?: boolean;
  cacheMiss?: boolean;
}): void {
  const s = get(input.companyId);
  s.toolExecutions += 1;
  s.totalDurationMs += Math.max(0, input.durationMs || 0);
  inc(s.usageByTool, input.toolId);
  inc(s.usageByVersion, `${input.toolId}@${input.toolVersion}`);
  inc(s.usageBySource, String(input.source));
  inc(s.usageByRisk, String(input.riskLevel));
  inc(s.usageBySideEffect, String(input.sideEffectType));

  const lat = s.latencyByTool[input.toolId] || { totalMs: 0, count: 0 };
  lat.totalMs += Math.max(0, input.durationMs || 0);
  lat.count += 1;
  s.latencyByTool[input.toolId] = lat;

  if (input.status === "success") s.toolSuccesses += 1;
  else if (input.status === "denied" || input.status === "skipped")
    s.toolDenials += 1;
  else if (input.status === "waiting_confirmation") s.toolConfirmations += 1;
  else s.toolFailures += 1;

  if (input.timedOut) s.toolTimeouts += 1;
  if (input.retries && input.retries > 0) s.toolRetries += input.retries;
  if (input.rolledBack) s.toolRollbacks += 1;
  if (input.confirmation) s.toolConfirmations += 1;
  if (input.emptyResult) s.emptyResults += 1;
  if (typeof input.resultCount === "number") {
    s.totalResultCount += Math.max(0, input.resultCount);
  }
  if (input.cacheHit) s.cacheHits += 1;
  if (input.cacheMiss) s.cacheMisses += 1;
}

export function getToolMetricsSnapshot(companyId: number): ToolMetricsState & {
  averageToolDuration: number;
  topToolsByUsage: Array<{ toolId: string; count: number }>;
  averageLatencyByTool: Record<string, number>;
} {
  const s = get(companyId);
  const topToolsByUsage = Object.entries(s.usageByTool)
    .map(([toolId, count]) => ({ toolId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const averageLatencyByTool: Record<string, number> = {};
  for (const [toolId, lat] of Object.entries(s.latencyByTool)) {
    averageLatencyByTool[toolId] =
      lat.count > 0 ? Math.round(lat.totalMs / lat.count) : 0;
  }

  return {
    ...s,
    usageByTool: { ...s.usageByTool },
    usageByVersion: { ...s.usageByVersion },
    usageBySource: { ...s.usageBySource },
    usageByRisk: { ...s.usageByRisk },
    usageBySideEffect: { ...s.usageBySideEffect },
    latencyByTool: { ...s.latencyByTool },
    averageToolDuration:
      s.toolExecutions > 0
        ? Math.round(s.totalDurationMs / s.toolExecutions)
        : 0,
    topToolsByUsage,
    averageLatencyByTool
  };
}

export function __resetToolMetricsForTests(): void {
  byCompany.clear();
}
