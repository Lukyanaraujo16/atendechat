type FcMetricsState = {
  selectedTools: number;
  availableTools: number;
  toolCalls: number;
  toolFailures: number;
  toolDenials: number;
  invalidCalls: number;
  loopStops: number;
  iterations: number;
  providerLatencyMs: number;
  toolLatencyMs: number;
  usageByTool: Record<string, number>;
  unusedTools: Set<string>;
  selectedToolIds: Set<string>;
  usedToolIds: Set<string>;
};

const byCompany = new Map<number, FcMetricsState>();

function empty(): FcMetricsState {
  return {
    selectedTools: 0,
    availableTools: 0,
    toolCalls: 0,
    toolFailures: 0,
    toolDenials: 0,
    invalidCalls: 0,
    loopStops: 0,
    iterations: 0,
    providerLatencyMs: 0,
    toolLatencyMs: 0,
    usageByTool: {},
    unusedTools: new Set(),
    selectedToolIds: new Set(),
    usedToolIds: new Set()
  };
}

function get(companyId: number): FcMetricsState {
  let s = byCompany.get(companyId);
  if (!s) {
    s = empty();
    byCompany.set(companyId, s);
  }
  return s;
}

export function recordFunctionCallingSelection(input: {
  companyId: number;
  selectedIds: string[];
  availableCount: number;
}): void {
  const s = get(input.companyId);
  s.selectedTools += input.selectedIds.length;
  s.availableTools += input.availableCount;
  for (const id of input.selectedIds) {
    s.selectedToolIds.add(id);
  }
}

export function recordFunctionCallingMetric(input: {
  companyId: number;
  kind:
    | "toolCall"
    | "toolDenial"
    | "invalidCall"
    | "loopStop"
    | "iteration"
    | "providerLatency"
    | "toolLatency";
  toolId?: string;
  durationMs?: number;
  status?: string;
}): void {
  const s = get(input.companyId);
  if (input.kind === "iteration") s.iterations += 1;
  if (input.kind === "loopStop") s.loopStops += 1;
  if (input.kind === "invalidCall") s.invalidCalls += 1;
  if (input.kind === "toolDenial") s.toolDenials += 1;
  if (input.kind === "providerLatency") {
    s.providerLatencyMs += Math.max(0, input.durationMs || 0);
  }
  if (input.kind === "toolLatency" || input.kind === "toolCall") {
    s.toolLatencyMs += Math.max(0, input.durationMs || 0);
  }
  if (input.kind === "toolCall") {
    s.toolCalls += 1;
    if (input.toolId) {
      s.usageByTool[input.toolId] = (s.usageByTool[input.toolId] || 0) + 1;
      s.usedToolIds.add(input.toolId);
    }
    if (input.status && input.status !== "success") {
      if (input.status === "denied" || input.status === "skipped") {
        s.toolDenials += 1;
      } else {
        s.toolFailures += 1;
      }
    }
  }
}

export function getFunctionCallingMetricsSnapshot(companyId: number): {
  selectedTools: number;
  availableTools: number;
  toolCalls: number;
  toolFailures: number;
  toolDenials: number;
  invalidCalls: number;
  loopStops: number;
  iterations: number;
  providerLatencyMs: number;
  toolLatencyMs: number;
  topTools: Array<{ toolId: string; count: number }>;
  neverUsedTools: string[];
  averageToolLatencyMs: number;
} {
  const s = get(companyId);
  const neverUsedTools = [...s.selectedToolIds].filter(
    id => !s.usedToolIds.has(id)
  );
  const topTools = Object.entries(s.usageByTool)
    .map(([toolId, count]) => ({ toolId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  return {
    selectedTools: s.selectedTools,
    availableTools: s.availableTools,
    toolCalls: s.toolCalls,
    toolFailures: s.toolFailures,
    toolDenials: s.toolDenials,
    invalidCalls: s.invalidCalls,
    loopStops: s.loopStops,
    iterations: s.iterations,
    providerLatencyMs: s.providerLatencyMs,
    toolLatencyMs: s.toolLatencyMs,
    topTools,
    neverUsedTools,
    averageToolLatencyMs:
      s.toolCalls > 0 ? Math.round(s.toolLatencyMs / s.toolCalls) : 0
  };
}

export function __resetFunctionCallingMetricsForTests(): void {
  byCompany.clear();
}

export default {
  recordFunctionCallingMetric,
  recordFunctionCallingSelection,
  getFunctionCallingMetricsSnapshot
};
