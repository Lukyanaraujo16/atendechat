type ShadowFcMetricsState = {
  shadowExecutions: number;
  shadowWithTools: number;
  shadowWithoutTools: number;
  toolCalls: number;
  toolFailures: number;
  toolDenials: number;
  knowledgeQueries: number;
  toolLatencyMs: number;
  providerLatencyMs: number;
  tokens: number;
  costUsd: number;
  loopStops: number;
  emptyToolResults: number;
  usageByTool: Record<string, number>;
  failuresByTool: Record<string, number>;
  denialsByTool: Record<string, number>;
  usageByProvider: Record<string, number>;
  selectedToolIds: Set<string>;
  usedToolIds: Set<string>;
};

const byCompany = new Map<number, ShadowFcMetricsState>();

function empty(): ShadowFcMetricsState {
  return {
    shadowExecutions: 0,
    shadowWithTools: 0,
    shadowWithoutTools: 0,
    toolCalls: 0,
    toolFailures: 0,
    toolDenials: 0,
    knowledgeQueries: 0,
    toolLatencyMs: 0,
    providerLatencyMs: 0,
    tokens: 0,
    costUsd: 0,
    loopStops: 0,
    emptyToolResults: 0,
    usageByTool: {},
    failuresByTool: {},
    denialsByTool: {},
    usageByProvider: {},
    selectedToolIds: new Set(),
    usedToolIds: new Set()
  };
}

function get(companyId: number): ShadowFcMetricsState {
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

export function recordShadowFcExecution(input: {
  companyId: number;
  provider?: string | null;
  usedTools: boolean;
  usedKnowledge: boolean;
  toolCallCount: number;
  toolLatencyMs?: number;
  providerLatencyMs?: number;
  tokens?: number;
  costUsd?: number | null;
  loopStopped?: boolean;
  selectedToolIds?: string[];
  resolutions?: Array<{
    toolId: string;
    status: string;
    empty?: boolean;
  }>;
}): void {
  const s = get(input.companyId);
  s.shadowExecutions += 1;
  if (input.usedTools) s.shadowWithTools += 1;
  else s.shadowWithoutTools += 1;
  if (input.usedKnowledge) s.knowledgeQueries += 1;
  s.toolCalls += Math.max(0, input.toolCallCount || 0);
  s.toolLatencyMs += Math.max(0, input.toolLatencyMs || 0);
  s.providerLatencyMs += Math.max(0, input.providerLatencyMs || 0);
  s.tokens += Math.max(0, input.tokens || 0);
  if (input.costUsd != null) s.costUsd += Math.max(0, input.costUsd);
  if (input.loopStopped) s.loopStops += 1;
  if (input.provider) inc(s.usageByProvider, input.provider);
  for (const id of input.selectedToolIds || []) s.selectedToolIds.add(id);
  for (const r of input.resolutions || []) {
    inc(s.usageByTool, r.toolId);
    s.usedToolIds.add(r.toolId);
    if (r.status === "denied") {
      s.toolDenials += 1;
      inc(s.denialsByTool, r.toolId);
    } else if (r.status === "failure" || r.status === "invalid") {
      s.toolFailures += 1;
      inc(s.failuresByTool, r.toolId);
    }
    if (r.empty) s.emptyToolResults += 1;
  }
}

export function getShadowFcMetricsSnapshot(companyId: number): {
  shadowExecutions: number;
  shadowWithTools: number;
  shadowWithoutTools: number;
  toolUsageRate: number;
  knowledgeUsageRate: number;
  averageToolCalls: number;
  averageLatencyMs: number;
  averageTokens: number;
  averageCostUsd: number;
  toolFailureRate: number;
  toolDeniedRate: number;
  emptyToolResults: number;
  loopStops: number;
  topTools: Array<{ toolId: string; count: number }>;
  topFailures: Array<{ toolId: string; count: number }>;
  topDenials: Array<{ toolId: string; count: number }>;
  neverUsedTools: string[];
  byProvider: Record<string, number>;
} {
  const s = get(companyId);
  const exec = s.shadowExecutions || 0;
  const top = (map: Record<string, number>) =>
    Object.entries(map)
      .map(([toolId, count]) => ({ toolId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

  return {
    shadowExecutions: exec,
    shadowWithTools: s.shadowWithTools,
    shadowWithoutTools: s.shadowWithoutTools,
    toolUsageRate: exec ? s.shadowWithTools / exec : 0,
    knowledgeUsageRate: exec ? s.knowledgeQueries / exec : 0,
    averageToolCalls: exec ? s.toolCalls / exec : 0,
    averageLatencyMs: exec
      ? Math.round((s.providerLatencyMs + s.toolLatencyMs) / exec)
      : 0,
    averageTokens: exec ? Math.round(s.tokens / exec) : 0,
    averageCostUsd: exec ? Number((s.costUsd / exec).toFixed(6)) : 0,
    toolFailureRate: s.toolCalls ? s.toolFailures / s.toolCalls : 0,
    toolDeniedRate: s.toolCalls ? s.toolDenials / s.toolCalls : 0,
    emptyToolResults: s.emptyToolResults,
    loopStops: s.loopStops,
    topTools: top(s.usageByTool),
    topFailures: top(s.failuresByTool),
    topDenials: top(s.denialsByTool),
    neverUsedTools: [...s.selectedToolIds].filter(id => !s.usedToolIds.has(id)),
    byProvider: { ...s.usageByProvider }
  };
}

export function __resetShadowFcMetricsForTests(): void {
  byCompany.clear();
}

export default {
  recordShadowFcExecution,
  getShadowFcMetricsSnapshot
};
