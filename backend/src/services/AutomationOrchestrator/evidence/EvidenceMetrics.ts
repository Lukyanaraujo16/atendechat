import { EvidenceType } from "../../../config/automationEvidenceConstants";
import { EvidenceFinding } from "./evidenceTypes";

type ToolAgg = {
  usage: number;
  verified: number;
  empty: number;
  failures: number;
  hallucinations: number;
  latencySum: number;
  costSum: number;
};

type ProviderAgg = {
  samples: number;
  verified: number;
  hallucinations: number;
  latencySum: number;
  costSum: number;
  failures: number;
  denials: number;
};

type AgentAgg = {
  samples: number;
  verified: number;
  hallucinations: number;
  knowledgeVerified: number;
  toolUsage: number;
  latencySum: number;
  costSum: number;
};

type ConnectionAgg = {
  samples: number;
  verified: number;
  hallucinations: number;
  knowledgeVerified: number;
  toolUsage: number;
  providers: Record<string, number>;
};

type CompanyState = {
  samples: number;
  verified: number;
  partiallyVerified: number;
  hallucinations: number;
  knowledgeVerified: number;
  knowledgeUnused: number;
  emptyResult: number;
  toolUnused: number;
  withTools: number;
  toolCalls: number;
  failures: number;
  denials: number;
  loopStops: number;
  latencySum: number;
  tokensSum: number;
  costSum: number;
  typeCounts: Record<string, number>;
  tools: Record<string, ToolAgg>;
  providers: Record<string, ProviderAgg>;
  agents: Record<number, AgentAgg>;
  connections: Record<number, ConnectionAgg>;
  selectedNeverUsed: Set<string>;
};

const byCompany = new Map<number, CompanyState>();

function empty(): CompanyState {
  return {
    samples: 0,
    verified: 0,
    partiallyVerified: 0,
    hallucinations: 0,
    knowledgeVerified: 0,
    knowledgeUnused: 0,
    emptyResult: 0,
    toolUnused: 0,
    withTools: 0,
    toolCalls: 0,
    failures: 0,
    denials: 0,
    loopStops: 0,
    latencySum: 0,
    tokensSum: 0,
    costSum: 0,
    typeCounts: {},
    tools: {},
    providers: {},
    agents: {},
    connections: {},
    selectedNeverUsed: new Set()
  };
}

function get(companyId: number): CompanyState {
  let s = byCompany.get(companyId);
  if (!s) {
    s = empty();
    byCompany.set(companyId, s);
  }
  return s;
}

function toolAgg(s: CompanyState, toolId: string): ToolAgg {
  if (!s.tools[toolId]) {
    s.tools[toolId] = {
      usage: 0,
      verified: 0,
      empty: 0,
      failures: 0,
      hallucinations: 0,
      latencySum: 0,
      costSum: 0
    };
  }
  return s.tools[toolId];
}

export function recordEvidenceReport(input: {
  companyId: number;
  aiAgentId?: number | null;
  whatsappId?: number | null;
  provider?: string | null;
  primaryType: string;
  verified: boolean;
  hallucination: boolean;
  knowledgeVerified: boolean;
  knowledgeUnused: boolean;
  emptyResult: boolean;
  toolUnused: boolean;
  toolCallCount: number;
  latencyMs?: number | null;
  tokens?: number | null;
  costUsd?: number | null;
  loopStopped?: boolean;
  toolIds?: string[];
  findings?: EvidenceFinding[];
}): void {
  const s = get(input.companyId);
  s.samples += 1;
  if (input.verified) s.verified += 1;
  if (input.hallucination) s.hallucinations += 1;
  if (input.knowledgeVerified) s.knowledgeVerified += 1;
  if (input.knowledgeUnused) s.knowledgeUnused += 1;
  if (input.emptyResult) s.emptyResult += 1;
  if (input.toolUnused) s.toolUnused += 1;
  if (input.toolCallCount > 0) s.withTools += 1;
  s.toolCalls += Math.max(0, input.toolCallCount);
  if (input.loopStopped) s.loopStops += 1;
  s.latencySum += Math.max(0, input.latencyMs || 0);
  s.tokensSum += Math.max(0, input.tokens || 0);
  s.costSum += Math.max(0, input.costUsd || 0);
  s.typeCounts[input.primaryType] = (s.typeCounts[input.primaryType] || 0) + 1;

  for (const f of input.findings || []) {
    s.typeCounts[f.type] = (s.typeCounts[f.type] || 0) + 1;
    if (f.type === "PARTIALLY_VERIFIED") s.partiallyVerified += 1;
    if (f.toolId) {
      const t = toolAgg(s, f.toolId);
      t.usage += 1;
      if (f.type === "VERIFIED" || f.type === "PARTIALLY_VERIFIED") t.verified += 1;
      if (f.type === "EMPTY_RESULT") t.empty += 1;
      if (f.type === "HALLUCINATION_AFTER_TOOL") t.hallucinations += 1;
      if (f.type === "INVALID_TOOL_SELECTION") t.failures += 1;
    }
  }

  if (input.provider) {
    if (!s.providers[input.provider]) {
      s.providers[input.provider] = {
        samples: 0,
        verified: 0,
        hallucinations: 0,
        latencySum: 0,
        costSum: 0,
        failures: 0,
        denials: 0
      };
    }
    const p = s.providers[input.provider];
    p.samples += 1;
    if (input.verified) p.verified += 1;
    if (input.hallucination) p.hallucinations += 1;
    p.latencySum += Math.max(0, input.latencyMs || 0);
    p.costSum += Math.max(0, input.costUsd || 0);
  }

  if (input.aiAgentId != null) {
    if (!s.agents[input.aiAgentId]) {
      s.agents[input.aiAgentId] = {
        samples: 0,
        verified: 0,
        hallucinations: 0,
        knowledgeVerified: 0,
        toolUsage: 0,
        latencySum: 0,
        costSum: 0
      };
    }
    const a = s.agents[input.aiAgentId];
    a.samples += 1;
    if (input.verified) a.verified += 1;
    if (input.hallucination) a.hallucinations += 1;
    if (input.knowledgeVerified) a.knowledgeVerified += 1;
    if (input.toolCallCount > 0) a.toolUsage += 1;
    a.latencySum += Math.max(0, input.latencyMs || 0);
    a.costSum += Math.max(0, input.costUsd || 0);
  }

  if (input.whatsappId != null) {
    if (!s.connections[input.whatsappId]) {
      s.connections[input.whatsappId] = {
        samples: 0,
        verified: 0,
        hallucinations: 0,
        knowledgeVerified: 0,
        toolUsage: 0,
        providers: {}
      };
    }
    const c = s.connections[input.whatsappId];
    c.samples += 1;
    if (input.verified) c.verified += 1;
    if (input.hallucination) c.hallucinations += 1;
    if (input.knowledgeVerified) c.knowledgeVerified += 1;
    if (input.toolCallCount > 0) c.toolUsage += 1;
    if (input.provider) {
      c.providers[input.provider] = (c.providers[input.provider] || 0) + 1;
    }
  }
}

export function getEvidenceMetricsSnapshot(companyId: number) {
  const s = get(companyId);
  const n = s.samples || 0;
  const rate = (x: number) => (n ? x / n : 0);

  return {
    sampleCount: n,
    verificationRate: rate(s.verified),
    toolUtilizationRate: rate(s.withTools),
    hallucinationRate: rate(s.hallucinations),
    knowledgeUtilizationRate: rate(s.knowledgeVerified),
    selectionAccuracy: n
      ? 1 -
        (s.typeCounts.INVALID_TOOL_SELECTION || 0) / Math.max(1, s.toolCalls || n)
      : 0,
    averageToolCalls: n ? s.toolCalls / n : 0,
    averageLatency: n ? Math.round(s.latencySum / n) : 0,
    averageCost: n ? Number((s.costSum / n).toFixed(6)) : 0,
    averageTokens: n ? Math.round(s.tokensSum / n) : 0,
    toolFailureRate: s.toolCalls
      ? (s.typeCounts.INVALID_TOOL_SELECTION || 0) / s.toolCalls
      : 0,
    toolDeniedRate: 0,
    loopStopRate: rate(s.loopStops),
    typeCounts: { ...s.typeCounts },
    tools: Object.entries(s.tools).map(([toolId, t]) => ({
      toolId,
      usageRate: n ? t.usage / n : 0,
      verificationRate: t.usage ? t.verified / t.usage : 0,
      failureRate: t.usage ? t.failures / t.usage : 0,
      emptyRate: t.usage ? t.empty / t.usage : 0,
      hallucinationRate: t.usage ? t.hallucinations / t.usage : 0,
      usage: t.usage,
      neverUsed: false
    })),
    providers: Object.entries(s.providers).map(([provider, p]) => ({
      provider,
      samples: p.samples,
      verificationRate: p.samples ? p.verified / p.samples : 0,
      hallucinationRate: p.samples ? p.hallucinations / p.samples : 0,
      averageLatency: p.samples ? Math.round(p.latencySum / p.samples) : 0,
      averageCost: p.samples ? Number((p.costSum / p.samples).toFixed(6)) : 0,
      failures: p.failures,
      denials: p.denials
    })),
    agents: Object.entries(s.agents).map(([id, a]) => ({
      aiAgentId: Number(id),
      samples: a.samples,
      verificationRate: a.samples ? a.verified / a.samples : 0,
      hallucinationRate: a.samples ? a.hallucinations / a.samples : 0,
      knowledgeUsage: a.samples ? a.knowledgeVerified / a.samples : 0,
      toolUsage: a.samples ? a.toolUsage / a.samples : 0,
      averageCost: a.samples ? Number((a.costSum / a.samples).toFixed(6)) : 0,
      averageLatency: a.samples ? Math.round(a.latencySum / a.samples) : 0
    })),
    connections: Object.entries(s.connections).map(([id, c]) => ({
      whatsappId: Number(id),
      samples: c.samples,
      verificationRate: c.samples ? c.verified / c.samples : 0,
      hallucinationRate: c.samples ? c.hallucinations / c.samples : 0,
      knowledgeUsage: c.samples ? c.knowledgeVerified / c.samples : 0,
      toolUsage: c.samples ? c.toolUsage / c.samples : 0,
      providers: { ...c.providers }
    }))
  };
}

export function __resetEvidenceMetricsForTests(): void {
  byCompany.clear();
}

export type { EvidenceType };
export default {
  recordEvidenceReport,
  getEvidenceMetricsSnapshot
};
