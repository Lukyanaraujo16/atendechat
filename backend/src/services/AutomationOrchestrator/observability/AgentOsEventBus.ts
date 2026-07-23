import { sanitizeAutomationPayload } from "../sanitizeAutomationPayload";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { AGENTOS_OBSERVABILITY_MODULE_KEY } from "../../../config/automationAgentOsObservabilityConstants";
import { getObservabilityConfig } from "./ObservabilityConfig";
import { agentOsLog } from "./StructuredLogger";
import {
  AgentOsStandardEvent,
  AgentOsTraceContext,
  newId
} from "./types";
import {
  AgentOsOrigin,
  AgentOsSeverity
} from "../../../config/automationAgentOsObservabilityConstants";

const eventsByCompany = new Map<number, AgentOsStandardEvent[]>();

function pushEvent(ev: AgentOsStandardEvent): void {
  const cfg = getObservabilityConfig();
  const list = eventsByCompany.get(ev.companyId) || [];
  list.unshift(ev);
  if (list.length > cfg.maxInMemoryEvents) list.length = cfg.maxInMemoryEvents;
  eventsByCompany.set(ev.companyId, list);
}

export function emitAgentOsEvent(input: {
  ctx: AgentOsTraceContext;
  type: string;
  severity?: AgentOsSeverity;
  origin: AgentOsOrigin;
  payload?: Record<string, unknown>;
}): AgentOsStandardEvent {
  const cfg = getObservabilityConfig();
  const event: AgentOsStandardEvent = {
    eventId: newId("evt"),
    traceId: input.ctx.traceId,
    correlationId: input.ctx.correlationId,
    executionId: input.ctx.executionId,
    sessionId: input.ctx.sessionId,
    rootSessionId: input.ctx.rootSessionId,
    companyId: input.ctx.companyId,
    agentId: input.ctx.agentId,
    type: input.type,
    severity: input.severity || "info",
    origin: input.origin,
    payload: sanitizeAutomationPayload(input.payload || {}),
    timestamp: new Date().toISOString()
  };

  if (!cfg.enabled) return event;

  pushEvent(event);
  agentOsLog(event.severity === "error" || event.severity === "critical" ? "error" : "info", {
    eventId: event.eventId,
    traceId: event.traceId,
    correlationId: event.correlationId,
    companyId: event.companyId,
    type: event.type,
    origin: event.origin,
    severity: event.severity
  });

  if (cfg.persistEvents) {
    observabilityRepository.writeEventFireAndForget({
      companyId: event.companyId,
      moduleKey: AGENTOS_OBSERVABILITY_MODULE_KEY,
      eventName: event.type,
      entityId: event.eventId,
      payload: {
        ...event.payload,
        eventId: event.eventId,
        traceId: event.traceId,
        correlationId: event.correlationId,
        executionId: event.executionId,
        sessionId: event.sessionId,
        rootSessionId: event.rootSessionId,
        agentId: event.agentId,
        severity: event.severity,
        origin: event.origin,
        timestamp: event.timestamp
      }
    });
  }

  return event;
}

export function listAgentOsEvents(
  companyId: number,
  opts?: {
    traceId?: string;
    sessionId?: string;
    origin?: string;
    limit?: number;
  }
): AgentOsStandardEvent[] {
  let list = eventsByCompany.get(companyId) || [];
  if (opts?.traceId) list = list.filter(e => e.traceId === opts.traceId);
  if (opts?.sessionId) list = list.filter(e => e.sessionId === opts.sessionId);
  if (opts?.origin) list = list.filter(e => e.origin === opts.origin);
  return list.slice(0, opts?.limit || 100);
}

export function resetAgentOsEvents(companyId?: number): void {
  if (companyId == null) eventsByCompany.clear();
  else eventsByCompany.delete(companyId);
}

export default emitAgentOsEvent;
