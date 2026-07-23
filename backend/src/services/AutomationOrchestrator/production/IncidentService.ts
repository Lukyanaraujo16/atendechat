import { randomBytes } from "crypto";
import { AGENTOS_INCIDENT_MODULE_KEY } from "../../../config/automationAgentOsProductionConstants";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { emitAgentOsEvent } from "../observability/AgentOsEventBus";
import { createTraceContext } from "../observability/types";
import { sanitizeAutomationPayload } from "../sanitizeAutomationPayload";

export type IncidentStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "MITIGATING"
  | "RESOLVED"
  | "CLOSED";

export type AgentOsIncident = {
  incidentId: string;
  companyId: number | null;
  severity: "info" | "warn" | "error" | "critical";
  status: IncidentStatus;
  source: string;
  type: string;
  title: string;
  description: string;
  traceId?: string | null;
  sessionId?: string | null;
  agentId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  rolloutState?: string | null;
  detectedAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  ownerUserId?: number | null;
  resolution?: string | null;
  evidenceRefs?: string[];
  auditRefs?: string[];
  createdAt: string;
  updatedAt: string;
};

const mem = new Map<string, AgentOsIncident>();

export async function openIncident(input: {
  companyId: number | null;
  severity?: AgentOsIncident["severity"];
  type: string;
  title: string;
  description: string;
  source?: string;
  traceId?: string;
  sessionId?: string;
  agentId?: string;
  rolloutState?: string;
}): Promise<AgentOsIncident> {
  const now = new Date().toISOString();
  const incident: AgentOsIncident = {
    incidentId: `inc_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    companyId: input.companyId,
    severity: input.severity || "error",
    status: "OPEN",
    source: input.source || "system",
    type: input.type,
    title: input.title,
    description: String(input.description).slice(0, 500),
    traceId: input.traceId ?? null,
    sessionId: input.sessionId ?? null,
    agentId: input.agentId ?? null,
    rolloutState: input.rolloutState ?? null,
    detectedAt: now,
    createdAt: now,
    updatedAt: now,
    evidenceRefs: [],
    auditRefs: []
  };
  mem.set(incident.incidentId, incident);

  if (input.companyId) {
    observabilityRepository.writeEventFireAndForget({
      companyId: input.companyId,
      moduleKey: AGENTOS_INCIDENT_MODULE_KEY,
      eventName: "INCIDENT_OPENED",
      entityId: incident.incidentId,
      payload: sanitizeAutomationPayload(incident as any)
    });
    const ctx = createTraceContext({ companyId: input.companyId });
    emitAgentOsEvent({
      ctx,
      type: "INCIDENT_OPENED",
      origin: "ops",
      severity: incident.severity === "critical" ? "critical" : "error",
      payload: { incidentId: incident.incidentId, type: incident.type }
    });
  }
  return incident;
}

export function listIncidents(companyId: number, limit = 50): AgentOsIncident[] {
  return Array.from(mem.values())
    .filter(i => i.companyId === companyId || i.companyId == null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function getIncident(incidentId: string): AgentOsIncident | null {
  return mem.get(incidentId) || null;
}

export function acknowledgeIncident(
  incidentId: string,
  userId: number
): AgentOsIncident | null {
  const i = mem.get(incidentId);
  if (!i) return null;
  i.status = "ACKNOWLEDGED";
  i.acknowledgedAt = new Date().toISOString();
  i.ownerUserId = userId;
  i.updatedAt = i.acknowledgedAt;
  if (i.companyId) {
    emitAgentOsEvent({
      ctx: createTraceContext({ companyId: i.companyId }),
      type: "INCIDENT_ACKNOWLEDGED",
      origin: "ops",
      severity: "info",
      payload: { incidentId }
    });
  }
  return i;
}

export function resolveIncident(
  incidentId: string,
  resolution: string
): AgentOsIncident | null {
  const i = mem.get(incidentId);
  if (!i) return null;
  i.status = "RESOLVED";
  i.resolution = resolution;
  i.resolvedAt = new Date().toISOString();
  i.updatedAt = i.resolvedAt;
  if (i.companyId) {
    emitAgentOsEvent({
      ctx: createTraceContext({ companyId: i.companyId }),
      type: "INCIDENT_RESOLVED",
      origin: "ops",
      severity: "info",
      payload: { incidentId }
    });
  }
  return i;
}

export function resetIncidents(): void {
  mem.clear();
}
