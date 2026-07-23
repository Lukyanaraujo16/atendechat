import { sanitizeAutomationPayload } from "../sanitizeAutomationPayload";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { AGENTOS_OBSERVABILITY_MODULE_KEY } from "../../../config/automationAgentOsObservabilityConstants";
import { getObservabilityConfig } from "./ObservabilityConfig";
import {
  AgentOsTimeline,
  AgentOsTimelineStep,
  AgentOsTraceContext,
  newId
} from "./types";
import { AgentOsOrigin } from "../../../config/automationAgentOsObservabilityConstants";

const timelines = new Map<string, AgentOsTimeline>();

export function startTimeline(ctx: AgentOsTraceContext): AgentOsTimeline {
  const tl: AgentOsTimeline = {
    traceId: ctx.traceId,
    correlationId: ctx.correlationId,
    executionId: ctx.executionId,
    sessionId: ctx.sessionId,
    rootSessionId: ctx.rootSessionId,
    companyId: ctx.companyId,
    agentId: ctx.agentId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    steps: []
  };
  timelines.set(ctx.traceId, tl);
  const cfg = getObservabilityConfig();
  if (timelines.size > cfg.maxInMemoryTimelines) {
    const oldest = timelines.keys().next().value;
    if (oldest) timelines.delete(oldest);
  }
  return tl;
}

export function appendTimelineStep(
  traceId: string,
  step: Omit<AgentOsTimelineStep, "stepId" | "timestamp"> & {
    stepId?: string;
    timestamp?: string;
  }
): AgentOsTimeline | null {
  const tl = timelines.get(traceId);
  if (!tl) return null;
  const full: AgentOsTimelineStep = {
    stepId: step.stepId || newId("step"),
    origin: step.origin,
    timestamp: step.timestamp || new Date().toISOString(),
    latencyMs: Math.max(0, step.latencyMs || 0),
    input: sanitizeAutomationPayload(step.input || {}),
    output: sanitizeAutomationPayload(step.output || {}),
    status: step.status,
    warnings: step.warnings || [],
    errors: step.errors || [],
    retry: step.retry || 0,
    fallback: Boolean(step.fallback),
    boundary: step.boundary ?? null
  };
  tl.steps.push(full);
  return tl;
}

export function finishTimeline(traceId: string): AgentOsTimeline | null {
  const tl = timelines.get(traceId);
  if (!tl) return null;
  tl.endedAt = new Date().toISOString();
  const cfg = getObservabilityConfig();
  if (cfg.persistTimelines) {
    observabilityRepository.saveReplayFireAndForget({
      id: `timeline_${tl.traceId}`,
      companyId: tl.companyId,
      moduleKey: AGENTOS_OBSERVABILITY_MODULE_KEY,
      sourceId: tl.executionId,
      sessionId: tl.sessionId,
      agentId: tl.agentId,
      payload: {
        kind: "timeline",
        ...tl
      }
    });
  }
  return tl;
}

export function getTimeline(traceId: string): AgentOsTimeline | null {
  return timelines.get(traceId) || null;
}

export async function getTimelinePersistent(
  companyId: number,
  traceId: string
): Promise<AgentOsTimeline | null> {
  const mem = getTimeline(traceId);
  if (mem && mem.companyId === companyId) return mem;
  const row = await observabilityRepository.getReplay(
    companyId,
    `timeline_${traceId}`
  );
  if (!row?.payload) return null;
  const p = row.payload as any;
  if (p.kind === "timeline" && p.traceId === traceId) return p as AgentOsTimeline;
  return null;
}

export function listTimelines(companyId: number, limit = 50): AgentOsTimeline[] {
  return Array.from(timelines.values())
    .filter(t => t.companyId === companyId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, limit);
}

export function resetTimelines(): void {
  timelines.clear();
}

export function recordObservedStep(input: {
  ctx: AgentOsTraceContext;
  origin: AgentOsOrigin;
  latencyMs: number;
  status?: AgentOsTimelineStep["status"];
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  warnings?: string[];
  errors?: string[];
  retry?: number;
  fallback?: boolean;
  boundary?: string | null;
}): void {
  if (!timelines.has(input.ctx.traceId)) startTimeline(input.ctx);
  appendTimelineStep(input.ctx.traceId, {
    origin: input.origin,
    latencyMs: input.latencyMs,
    status: input.status || (input.errors?.length ? "error" : "ok"),
    input: input.inputPayload || {},
    output: input.outputPayload || {},
    warnings: input.warnings || [],
    errors: input.errors || [],
    retry: input.retry || 0,
    fallback: Boolean(input.fallback),
    boundary: input.boundary ?? null
  });
}
