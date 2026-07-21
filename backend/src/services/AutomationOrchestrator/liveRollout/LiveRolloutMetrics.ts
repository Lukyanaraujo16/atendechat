type LiveMetricsState = {
  liveExecutions: number;
  eligibleExecutions: number;
  ineligibleExecutions: number;
  fallbacks: number;
  rollbacks: number;
  timeouts: number;
  toolCalls: number;
  toolFailures: number;
  latencySum: number;
  tokensSum: number;
  costSum: number;
  canaryHits: number;
  canaryMisses: number;
  byStage: Record<string, number>;
  byProvider: Record<string, number>;
};

const byCompany = new Map<number, LiveMetricsState>();

function empty(): LiveMetricsState {
  return {
    liveExecutions: 0,
    eligibleExecutions: 0,
    ineligibleExecutions: 0,
    fallbacks: 0,
    rollbacks: 0,
    timeouts: 0,
    toolCalls: 0,
    toolFailures: 0,
    latencySum: 0,
    tokensSum: 0,
    costSum: 0,
    canaryHits: 0,
    canaryMisses: 0,
    byStage: {},
    byProvider: {}
  };
}

function get(companyId: number): LiveMetricsState {
  let s = byCompany.get(companyId);
  if (!s) {
    s = empty();
    byCompany.set(companyId, s);
  }
  return s;
}

export function recordLiveEligibility(input: {
  companyId: number;
  eligible: boolean;
  canaryIn?: boolean;
  stage?: string;
}): void {
  const s = get(input.companyId);
  if (input.eligible) s.eligibleExecutions += 1;
  else s.ineligibleExecutions += 1;
  if (input.canaryIn === true) s.canaryHits += 1;
  if (input.canaryIn === false) s.canaryMisses += 1;
  if (input.stage) {
    s.byStage[input.stage] = (s.byStage[input.stage] || 0) + 1;
  }
}

export function recordLiveFcExecution(input: {
  companyId: number;
  provider?: string | null;
  stage?: string;
  toolCallCount?: number;
  toolFailures?: number;
  latencyMs?: number;
  tokens?: number;
  costUsd?: number | null;
  fallback?: boolean;
  timeout?: boolean;
}): void {
  const s = get(input.companyId);
  s.liveExecutions += 1;
  s.toolCalls += Math.max(0, input.toolCallCount || 0);
  s.toolFailures += Math.max(0, input.toolFailures || 0);
  s.latencySum += Math.max(0, input.latencyMs || 0);
  s.tokensSum += Math.max(0, input.tokens || 0);
  if (input.costUsd != null) s.costSum += Math.max(0, input.costUsd);
  if (input.fallback) s.fallbacks += 1;
  if (input.timeout) s.timeouts += 1;
  if (input.provider) {
    s.byProvider[input.provider] = (s.byProvider[input.provider] || 0) + 1;
  }
  if (input.stage) {
    s.byStage[input.stage] = (s.byStage[input.stage] || 0) + 1;
  }
}

export function recordLiveRollback(companyId: number): void {
  get(companyId).rollbacks += 1;
}

export function getLiveRolloutMetricsSnapshot(companyId: number) {
  const s = get(companyId);
  const denom = s.canaryHits + s.canaryMisses;
  return {
    liveExecutions: s.liveExecutions,
    eligibleExecutions: s.eligibleExecutions,
    ineligibleExecutions: s.ineligibleExecutions,
    fallbacks: s.fallbacks,
    rollbacks: s.rollbacks,
    timeouts: s.timeouts,
    toolCalls: s.toolCalls,
    toolFailures: s.toolFailures,
    averageLatency: s.liveExecutions
      ? Math.round(s.latencySum / s.liveExecutions)
      : 0,
    averageTokens: s.liveExecutions
      ? Math.round(s.tokensSum / s.liveExecutions)
      : 0,
    averageCost: s.liveExecutions
      ? Number((s.costSum / s.liveExecutions).toFixed(6))
      : 0,
    canaryRate: denom ? s.canaryHits / denom : 0,
    byStage: { ...s.byStage },
    byProvider: { ...s.byProvider }
  };
}

export function __resetLiveRolloutMetricsForTests(): void {
  byCompany.clear();
}

export default {
  recordLiveEligibility,
  recordLiveFcExecution,
  getLiveRolloutMetricsSnapshot
};
