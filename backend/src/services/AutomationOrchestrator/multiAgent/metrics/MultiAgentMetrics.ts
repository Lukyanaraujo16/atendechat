import { createHash } from "crypto";
import { getMultiAgentConfig } from "../MultiAgentConfig";
import { MultiAgentAuditEntry } from "../types";
import { observabilityRepository } from "../../persistence/repositories/ObservabilityRepository";

type Metrics = {
  agentsConfigured: number;
  agentsActive: number;
  agentsSuspended: number;
  routingRequests: number;
  routingSuccesses: number;
  routingFailures: number;
  routingLatencySum: number;
  fallbacks: number;
  delegationsRequested: number;
  delegationsApproved: number;
  delegationsBlocked: number;
  delegationsCompleted: number;
  delegationsFailed: number;
  handoffsRequested: number;
  handoffsCompleted: number;
  handoffsFailed: number;
  loopsDetected: number;
  childSessionsCreated: number;
  coordinationPlansCreated: number;
  coordinationPlansCompleted: number;
  resultConflicts: number;
  humanInterventions: number;
  messagesSent: number;
  memoryAccessDenials: number;
  toolBoundaryDenials: number;
  mcpBoundaryDenials: number;
  policyDenials: number;
  agentsByRole: Record<string, number>;
  agentsBySpecialization: Record<string, number>;
  selectionsByAgent: Record<string, number>;
  selectionsByStrategy: Record<string, number>;
  agentHealthByStatus: Record<string, number>;
};

const metrics: Metrics = blank();
const audits: MultiAgentAuditEntry[] = [];

function blank(): Metrics {
  return {
    agentsConfigured: 0,
    agentsActive: 0,
    agentsSuspended: 0,
    routingRequests: 0,
    routingSuccesses: 0,
    routingFailures: 0,
    routingLatencySum: 0,
    fallbacks: 0,
    delegationsRequested: 0,
    delegationsApproved: 0,
    delegationsBlocked: 0,
    delegationsCompleted: 0,
    delegationsFailed: 0,
    handoffsRequested: 0,
    handoffsCompleted: 0,
    handoffsFailed: 0,
    loopsDetected: 0,
    childSessionsCreated: 0,
    coordinationPlansCreated: 0,
    coordinationPlansCompleted: 0,
    resultConflicts: 0,
    humanInterventions: 0,
    messagesSent: 0,
    memoryAccessDenials: 0,
    toolBoundaryDenials: 0,
    mcpBoundaryDenials: 0,
    policyDenials: 0,
    agentsByRole: {},
    agentsBySpecialization: {},
    selectionsByAgent: {},
    selectionsByStrategy: {},
    agentHealthByStatus: {}
  };
}

export function recordMultiAgentMetric(
  key: keyof Metrics,
  amount = 1,
  bucket?: { role?: string; specialization?: string; agentId?: string; strategy?: string; health?: string }
): void {
  if (typeof (metrics as any)[key] === "number") {
    (metrics as any)[key] += amount;
  }
  if (bucket?.role) {
    metrics.agentsByRole[bucket.role] =
      (metrics.agentsByRole[bucket.role] || 0) + amount;
  }
  if (bucket?.specialization) {
    metrics.agentsBySpecialization[bucket.specialization] =
      (metrics.agentsBySpecialization[bucket.specialization] || 0) + amount;
  }
  if (bucket?.agentId) {
    metrics.selectionsByAgent[bucket.agentId] =
      (metrics.selectionsByAgent[bucket.agentId] || 0) + amount;
  }
  if (bucket?.strategy) {
    metrics.selectionsByStrategy[bucket.strategy] =
      (metrics.selectionsByStrategy[bucket.strategy] || 0) + amount;
  }
  if (bucket?.health) {
    metrics.agentHealthByStatus[bucket.health] =
      (metrics.agentHealthByStatus[bucket.health] || 0) + amount;
  }
}

export function recordMultiAgentAudit(
  entry: Omit<MultiAgentAuditEntry, "id">
): MultiAgentAuditEntry {
  const cfg = getMultiAgentConfig(entry.companyId);
  const full: MultiAgentAuditEntry = {
    ...entry,
    id: `maaud_${createHash("sha256")
      .update(`${entry.companyId}:${entry.action}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    contextBoundarySummary: String(entry.contextBoundarySummary || "").slice(
      0,
      cfg.auditPayloadLimit
    )
  };
  audits.unshift(full);
  if (audits.length > 3000) audits.length = 3000;
  observabilityRepository.writeAuditFireAndForget({
    companyId: full.companyId,
    moduleKey: "multiAgent",
    action: full.action,
    agentId: full.agentId,
    sessionId: full.sessionId,
    userId: full.userId,
    previousState: full.previousState,
    newState: full.newState,
    reasonCodes: full.reasonCodes,
    payloadSanitized: { contextBoundarySummary: full.contextBoundarySummary }
  });
  return full;
}

export function listMultiAgentAudits(companyId: number, limit = 50) {
  return audits.filter(a => a.companyId === companyId).slice(0, limit);
}

export function getMultiAgentMetricsBase() {
  return {
    ...metrics,
    averageRoutingLatency: metrics.routingRequests
      ? metrics.routingLatencySum / metrics.routingRequests
      : 0,
    routingSuccessRate: metrics.routingRequests
      ? metrics.routingSuccesses / metrics.routingRequests
      : 0
  };
}

export function __resetMultiAgentMetricsForTests(): void {
  Object.assign(metrics, blank());
  audits.length = 0;
}

export default {
  recordMultiAgentMetric,
  recordMultiAgentAudit,
  getMultiAgentMetricsBase
};
