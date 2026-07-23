import { randomBytes } from "crypto";
import {
  AgentOsOrigin,
  AgentOsSeverity,
  AgentOsHealthStatus,
  AgentOsAlertType
} from "../../../config/automationAgentOsObservabilityConstants";

export type AgentOsTraceContext = {
  traceId: string;
  correlationId: string;
  executionId: string;
  sessionId: string;
  rootSessionId: string;
  companyId: number;
  agentId: string | null;
};

export type AgentOsStandardEvent = {
  eventId: string;
  traceId: string;
  correlationId: string;
  executionId: string;
  sessionId: string;
  rootSessionId: string;
  companyId: number;
  agentId: string | null;
  type: string;
  severity: AgentOsSeverity;
  origin: AgentOsOrigin;
  payload: Record<string, unknown>;
  timestamp: string;
};

export type AgentOsTimelineStep = {
  stepId: string;
  origin: AgentOsOrigin;
  timestamp: string;
  latencyMs: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: "ok" | "warn" | "error" | "skipped";
  warnings: string[];
  errors: string[];
  retry: number;
  fallback: boolean;
  boundary: string | null;
};

export type AgentOsTimeline = {
  traceId: string;
  correlationId: string;
  executionId: string;
  sessionId: string;
  rootSessionId: string;
  companyId: number;
  agentId: string | null;
  startedAt: string;
  endedAt: string | null;
  steps: AgentOsTimelineStep[];
};

export type AgentOsLatencySample = {
  origin: AgentOsOrigin;
  companyId: number;
  latencyMs: number;
  at: string;
  traceId?: string;
};

export type AgentOsAggregatedMetrics = {
  successCount: number;
  failureCount: number;
  latencySum: number;
  latencySamples: number[];
  throughput: number;
  retries: number;
  fallbacks: number;
  timeouts: number;
  rateLimitHits: number;
  byOrigin: Record<string, { count: number; latencySum: number; failures: number }>;
  topErrors: Record<string, number>;
  topTools: Record<string, number>;
  topMcp: Record<string, number>;
  byAgent: Record<string, number>;
};

export type AgentOsComponentHealth = {
  component: string;
  status: AgentOsHealthStatus;
  message?: string;
  checkedAt: string;
};

export type AgentOsHealthReport = {
  status: AgentOsHealthStatus;
  checkedAt: string;
  companyId: number;
  components: AgentOsComponentHealth[];
};

export type AgentOsAlert = {
  alertId: string;
  type: AgentOsAlertType;
  severity: AgentOsSeverity;
  companyId: number;
  traceId?: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  acknowledged: boolean;
};

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export function createTraceContext(input: {
  companyId: number;
  agentId?: string | null;
  sessionId?: string | null;
  rootSessionId?: string | null;
  executionId?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
}): AgentOsTraceContext {
  const sessionId = input.sessionId || newId("sess");
  return {
    companyId: input.companyId,
    agentId: input.agentId ?? null,
    sessionId,
    rootSessionId: input.rootSessionId || sessionId,
    executionId: input.executionId || newId("exec"),
    traceId: input.traceId || newId("trace"),
    correlationId: input.correlationId || newId("corr")
  };
}

export function emptyAggregatedMetrics(): AgentOsAggregatedMetrics {
  return {
    successCount: 0,
    failureCount: 0,
    latencySum: 0,
    latencySamples: [],
    throughput: 0,
    retries: 0,
    fallbacks: 0,
    timeouts: 0,
    rateLimitHits: 0,
    byOrigin: {},
    topErrors: {},
    topTools: {},
    topMcp: {},
    byAgent: {}
  };
}

export function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1)
  );
  return sortedAsc[idx];
}
