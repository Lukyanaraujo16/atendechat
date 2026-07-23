import { createTraceContext, AgentOsTraceContext } from "./types";
import { emitAgentOsEvent } from "./AgentOsEventBus";
import { recordObservedStep, finishTimeline, startTimeline } from "./TimelineBuilder";
import { recordLatency } from "./ObservabilityMetricsStore";
import { observeFailureForAlerts } from "./AlertEngine";
import { AgentOsOrigin } from "../../../config/automationAgentOsObservabilityConstants";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { AGENTOS_OBSERVABILITY_MODULE_KEY } from "../../../config/automationAgentOsObservabilityConstants";
import { sanitizeAutomationPayload } from "../sanitizeAutomationPayload";

/**
 * API única de observação — não altera decisões cognitivas.
 */
export function observeAgentOsStep(input: {
  companyId: number;
  origin: AgentOsOrigin;
  type: string;
  latencyMs: number;
  success?: boolean;
  agentId?: string | null;
  sessionId?: string | null;
  rootSessionId?: string | null;
  executionId?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  warnings?: string[];
  errors?: string[];
  retry?: number;
  fallback?: boolean;
  boundary?: string | null;
  errorCode?: string | null;
  toolId?: string | null;
  mcpServerId?: string | null;
  timeout?: boolean;
  rateLimited?: boolean;
  mcpDown?: boolean;
  loopDetected?: boolean;
  delegationBlocked?: boolean;
  finish?: boolean;
}): AgentOsTraceContext {
  const ctx = createTraceContext({
    companyId: input.companyId,
    agentId: input.agentId,
    sessionId: input.sessionId,
    rootSessionId: input.rootSessionId,
    executionId: input.executionId,
    traceId: input.traceId,
    correlationId: input.correlationId
  });

  startTimeline(ctx);
  recordObservedStep({
    ctx,
    origin: input.origin,
    latencyMs: input.latencyMs,
    status: input.success === false ? "error" : input.warnings?.length ? "warn" : "ok",
    inputPayload: input.inputPayload,
    outputPayload: input.outputPayload,
    warnings: input.warnings,
    errors: input.errors,
    retry: input.retry,
    fallback: input.fallback,
    boundary: input.boundary
  });

  emitAgentOsEvent({
    ctx,
    type: input.type,
    origin: input.origin,
    severity:
      input.success === false
        ? "error"
        : input.warnings?.length
          ? "warn"
          : "info",
    payload: {
      latencyMs: input.latencyMs,
      success: input.success !== false,
      errorCode: input.errorCode ?? null,
      toolId: input.toolId ?? null,
      mcpServerId: input.mcpServerId ?? null
    }
  });

  recordLatency({
    companyId: input.companyId,
    origin: input.origin,
    latencyMs: input.latencyMs,
    success: input.success,
    traceId: ctx.traceId,
    agentId: input.agentId,
    errorCode: input.errorCode,
    toolId: input.toolId,
    mcpServerId: input.mcpServerId,
    retry: Boolean(input.retry),
    fallback: Boolean(input.fallback),
    timeout: Boolean(input.timeout),
    rateLimited: Boolean(input.rateLimited)
  });

  if (
    input.success === false ||
    input.timeout ||
    input.rateLimited ||
    input.mcpDown ||
    input.loopDetected ||
    input.delegationBlocked ||
    (input.latencyMs || 0) > 0
  ) {
    if (
      input.success === false ||
      input.timeout ||
      input.rateLimited ||
      input.mcpDown ||
      input.loopDetected ||
      input.delegationBlocked ||
      (input.latencyMs || 0) >= 2000
    ) {
      observeFailureForAlerts({
        companyId: input.companyId,
        key: `${input.origin}:${input.type}`,
        traceId: ctx.traceId,
        latencyMs: input.latencyMs,
        rateLimited: input.rateLimited,
        timeout: input.timeout,
        mcpDown: input.mcpDown,
        loopDetected: input.loopDetected,
        delegationBlocked: input.delegationBlocked
      });
    }
  }

  if (input.finish) finishTimeline(ctx.traceId);

  observabilityRepository.writeAuditFireAndForget({
    companyId: ctx.companyId,
    moduleKey: AGENTOS_OBSERVABILITY_MODULE_KEY,
    action: input.type,
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    payloadSanitized: sanitizeAutomationPayload({
      traceId: ctx.traceId,
      correlationId: ctx.correlationId,
      executionId: ctx.executionId,
      origin: input.origin,
      latencyMs: input.latencyMs,
      success: input.success !== false
    })
  });

  return ctx;
}

export default observeAgentOsStep;
