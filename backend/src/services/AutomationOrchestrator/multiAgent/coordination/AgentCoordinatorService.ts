import { createHash } from "crypto";
import { getMultiAgentConfig } from "../MultiAgentConfig";
import { multiAgentStore } from "../stores/MultiAgentStore";
import { defaultAgentRegistry } from "../registry/AgentRegistry";
import { emitMultiAgentEvent } from "../MultiAgentEvents";
import { recordMultiAgentMetric } from "../metrics/MultiAgentMetrics";
import {
  AgentCoordinationPlan,
  AgentCoordinationTask,
  AgentMessage,
  AgentResultConflict,
  AgentHumanInterventionRequest,
  AgentHealthRecord,
  FallbackEvaluation
} from "../types";
import {
  AGENT_MESSAGE_TYPES,
  AgentMessageType,
  AgentSpecialization,
  ContextSharingLevel
} from "../../../../config/automationMultiAgentConstants";
import { evaluateAvailability } from "../selection/AgentSelectionEngine";
import { resolveAgentToolBoundary } from "../policies/AgentToolBoundaryResolver";

function cid(seed: string): string {
  return `crd_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

export function createCoordinationPlan(input: {
  companyId: number;
  coordinatorAgentId: string;
  rootGoalId: string;
  tasks: Array<Partial<AgentCoordinationTask> & { title: string }>;
}): AgentCoordinationPlan {
  const cfg = getMultiAgentConfig(input.companyId);
  if (!cfg.coordinationEnabled) throw new Error("ERR_AGENT_COORDINATION_DISABLED");
  if (!cfg.coordinatorSimulationOnly) {
    // still force simulation-only in this phase
  }
  const coordinator = defaultAgentRegistry.getById(
    input.companyId,
    input.coordinatorAgentId
  );
  if (!coordinator || !coordinator.isCoordinator && coordinator.role !== "COORDINATOR") {
    throw new Error("ERR_AGENT_PERMISSION_DENIED");
  }

  const tasks: AgentCoordinationTask[] = input.tasks.map((t, i) => ({
    id: cid(`task:${i}:${t.title}`),
    title: t.title,
    description: String(t.description || ""),
    requiredCapabilities: t.requiredCapabilities || [],
    preferredSpecialization:
      (t.preferredSpecialization as AgentSpecialization) || null,
    assignedAgentId: null,
    dependencies: t.dependencies || [],
    contextSharingLevel:
      (t.contextSharingLevel as ContextSharingLevel) ||
      cfg.defaultContextSharingLevel,
    expectedOutput: String(t.expectedOutput || ""),
    status: "PENDING",
    metadata: {}
  }));

  // assign specialists deterministically
  const assignments: Record<string, string> = {};
  for (const task of tasks) {
    const candidates = defaultAgentRegistry.findCandidates({
      companyId: input.companyId,
      capabilities: task.requiredCapabilities,
      specialization: task.preferredSpecialization,
      onlySelectable: true
    }).filter(a => a.id !== input.coordinatorAgentId);
    if (candidates[0]) {
      task.assignedAgentId = candidates[0].id;
      task.status = "ASSIGNED";
      assignments[task.id] = candidates[0].id;
    }
  }

  // parallel groups = tasks without unmet deps
  const ready = tasks.filter(t => t.dependencies.length === 0).map(t => t.id);
  const waiting = tasks.filter(t => t.dependencies.length).map(t => t.id);

  const plan: AgentCoordinationPlan = {
    id: cid(`${input.companyId}:${input.rootGoalId}`),
    companyId: input.companyId,
    coordinatorAgentId: input.coordinatorAgentId,
    rootGoalId: input.rootGoalId,
    tasks,
    dependencies: tasks.flatMap(t => t.dependencies),
    agentAssignments: assignments,
    parallelGroups: [ready.slice(0, cfg.maxConcurrentAgentsPerCoordination), waiting],
    maxDelegationDepth: cfg.maxDelegationDepth,
    maxConcurrentAgents: cfg.maxConcurrentAgentsPerCoordination,
    estimatedCost: null,
    estimatedDuration: null,
    requiresApproval: true,
    status: "SIMULATED",
    createdAt: new Date().toISOString(),
    metadata: {
      simulationOnly: true,
      liveIntegrationEnabled: false,
      continuousAutonomyEnabled: false
    }
  };
  multiAgentStore(input.companyId).putCoordination(plan);
  recordMultiAgentMetric("coordinationPlansCreated");
  emitMultiAgentEvent(input.companyId, "AGENT_COORDINATION_STARTED", plan.id);
  return plan;
}

export function simulateCoordination(input: {
  companyId: number;
  planId: string;
}): {
  plan: AgentCoordinationPlan;
  results: Array<{ taskId: string; agentId: string | null; output: string; confidence: number }>;
  conflicts: AgentResultConflict[];
} {
  const store = multiAgentStore(input.companyId);
  const plan = store.getCoordination(input.planId);
  if (!plan) throw new Error("ERR_AGENT_NOT_FOUND");

  const results = plan.tasks.map(t => ({
    taskId: t.id,
    agentId: t.assignedAgentId,
    output: `Simulated output for ${t.title}`,
    confidence: t.assignedAgentId ? 0.8 : 0.2
  }));

  const conflicts: AgentResultConflict[] = [];
  if (results.length >= 2 && results[0].confidence === results[1].confidence) {
    // demo conflict detection when same confidence different agents
    if (
      results[0].agentId &&
      results[1].agentId &&
      results[0].agentId !== results[1].agentId
    ) {
      const conflict: AgentResultConflict = {
        id: cid(`conflict:${plan.id}`),
        companyId: input.companyId,
        coordinationPlanId: plan.id,
        taskIds: [results[0].taskId, results[1].taskId],
        agentIds: [results[0].agentId!, results[1].agentId!],
        conflictType: "DIFFERENT_RECOMMENDATIONS",
        description: "Specialists produced parallel recommendations requiring review",
        results: results.slice(0, 2) as any,
        severity: "MEDIUM",
        recommendedResolution: "human_review",
        requiresHumanReview: true,
        createdAt: new Date().toISOString(),
        metadata: {}
      };
      store.putConflict(conflict);
      conflicts.push(conflict);
      recordMultiAgentMetric("resultConflicts");
      emitMultiAgentEvent(
        input.companyId,
        "AGENT_RESULT_CONFLICT_DETECTED",
        conflict.id
      );
    }
  }

  const updated = { ...plan, status: "COMPLETED_SIMULATION" };
  store.putCoordination(updated);
  recordMultiAgentMetric("coordinationPlansCompleted");
  emitMultiAgentEvent(input.companyId, "AGENT_COORDINATION_COMPLETED", plan.id);
  return { plan: updated, results, conflicts };
}

export function validateAgentMessage(input: {
  companyId: number;
  message: Partial<AgentMessage> & {
    sourceAgentId: string;
    targetAgentId: string;
    messageType: AgentMessageType;
    payload: Record<string, unknown>;
  };
}): { valid: boolean; errors: string[]; message?: AgentMessage } {
  const cfg = getMultiAgentConfig(input.companyId);
  const errors: string[] = [];
  const source = defaultAgentRegistry.getById(
    input.companyId,
    input.message.sourceAgentId
  );
  const target = defaultAgentRegistry.getById(
    input.companyId,
    input.message.targetAgentId
  );
  if (!source || !target) errors.push("ERR_AGENT_NOT_FOUND");
  if (source && source.companyId !== input.companyId) {
    errors.push("ERR_AGENT_TENANT_FORBIDDEN");
  }
  if (target && target.companyId !== input.companyId) {
    errors.push("ERR_AGENT_TENANT_FORBIDDEN");
  }
  if (
    !input.message.messageType ||
    !(AGENT_MESSAGE_TYPES as readonly string[]).includes(input.message.messageType)
  ) {
    errors.push("ERR_AGENT_MESSAGE_INVALID");
  }
  if (!input.message.payload || typeof input.message.payload !== "object") {
    errors.push("ERR_AGENT_MESSAGE_INVALID");
  }
  const size = JSON.stringify(input.message.payload || {}).length;
  if (size > cfg.auditPayloadLimit) errors.push("ERR_AGENT_MESSAGE_INVALID");

  if (errors.length) return { valid: false, errors };

  const message: AgentMessage = {
    id: cid(`msg:${Date.now()}`),
    companyId: input.companyId,
    sourceAgentId: input.message.sourceAgentId,
    targetAgentId: input.message.targetAgentId,
    sourceSessionId: input.message.sourceSessionId ?? null,
    targetSessionId: input.message.targetSessionId ?? null,
    messageType: input.message.messageType,
    correlationId: input.message.correlationId || cid("corr"),
    payload: input.message.payload,
    schemaVersion: "1.0",
    requiresResponse: input.message.requiresResponse === true,
    expiresAt:
      input.message.expiresAt ||
      new Date(Date.now() + cfg.messageTimeoutMs).toISOString(),
    createdAt: new Date().toISOString(),
    metadata: input.message.metadata || {}
  };

  if (new Date(message.expiresAt).getTime() < Date.now()) {
    return { valid: false, errors: ["ERR_AGENT_MESSAGE_EXPIRED"] };
  }

  multiAgentStore(input.companyId).putMessage(message);
  recordMultiAgentMetric("messagesSent");
  emitMultiAgentEvent(input.companyId, "AGENT_MESSAGE_SENT", message.id);
  emitMultiAgentEvent(input.companyId, "AGENT_MESSAGE_RECEIVED", message.id);
  return { valid: true, errors: [], message };
}

export function checkAgentHealth(input: {
  companyId: number;
  agentId: string;
  activeSessions?: number;
  recentFailures?: number;
  recentTotal?: number;
}): AgentHealthRecord {
  const cfg = getMultiAgentConfig(input.companyId);
  const agent = defaultAgentRegistry.getById(input.companyId, input.agentId);
  if (!agent || agent.companyId !== input.companyId) {
    throw new Error("ERR_AGENT_NOT_FOUND");
  }
  const availability = evaluateAvailability({
    agent,
    activeSessions: input.activeSessions
  });
  const boundary = resolveAgentToolBoundary({ companyId: input.companyId, agent });
  const issues: string[] = [...boundary.denials];
  const failureRate =
    (input.recentTotal || 0) > 0
      ? (input.recentFailures || 0) / (input.recentTotal || 1)
      : 0;

  let status: AgentHealthRecord["status"] = "HEALTHY";
  if (agent.status === "SUSPENDED" || agent.status === "ARCHIVED") {
    status = "UNHEALTHY";
    issues.push("status_unhealthy");
  } else if (failureRate >= cfg.healthThresholds.unhealthyFailureRate) {
    status = "UNHEALTHY";
  } else if (
    failureRate >= cfg.healthThresholds.degradedFailureRate ||
    availability.state === "DEGRADED" ||
    agent.status === "DEGRADED"
  ) {
    status = "DEGRADED";
  } else if (!agent.provider && !agent.model) {
    // config soft warning — still healthy for simulation
    issues.push("provider_model_optional_missing");
  }

  const record: AgentHealthRecord = {
    agentId: agent.id,
    companyId: input.companyId,
    status,
    availability: availability.state,
    activeSessions: input.activeSessions || 0,
    failureRate,
    latencyMs: null,
    checkedAt: new Date().toISOString(),
    issues,
    metadata: { sharedKernel: true }
  };
  multiAgentStore(input.companyId).putHealth(record);
  recordMultiAgentMetric("agentsConfigured", 0, { health: status });
  emitMultiAgentEvent(input.companyId, "AGENT_HEALTH_CHANGED", agent.id, {
    status
  });
  return record;
}

export function evaluateFallbackSafety(input: {
  companyId: number;
  preferredAgentId: string | null;
  capability?: string;
  writeAmbiguous?: boolean;
}): FallbackEvaluation {
  const cfg = getMultiAgentConfig(input.companyId);
  if (!cfg.fallbackEnabled) {
    return { safety: "NOT_AVAILABLE", fallbackAgentId: null, reasonCodes: ["fallback_disabled"] };
  }
  if (input.writeAmbiguous) {
    return {
      safety: "UNSAFE",
      fallbackAgentId: null,
      reasonCodes: ["write_ambiguous"]
    };
  }
  const candidates = defaultAgentRegistry
    .findCandidates({
      companyId: input.companyId,
      capabilities: input.capability ? [input.capability] : [],
      onlySelectable: true
    })
    .filter(a => a.id !== input.preferredAgentId);
  const fallback =
    candidates[0] || defaultAgentRegistry.resolveDefault(input.companyId);
  if (!fallback) {
    return {
      safety: "NOT_AVAILABLE",
      fallbackAgentId: null,
      reasonCodes: ["no_fallback"]
    };
  }
  return {
    safety: "SAFE",
    fallbackAgentId: fallback.id,
    reasonCodes: ["fallback_available"]
  };
}

export function createHumanIntervention(input: {
  companyId: number;
  sessionId: string;
  agentId: string;
  reason: string;
  severity?: string;
  requestedAction?: string;
  contextSummary?: string;
}): AgentHumanInterventionRequest {
  const item: AgentHumanInterventionRequest = {
    id: cid(`hiv:${Date.now()}`),
    companyId: input.companyId,
    sessionId: input.sessionId,
    agentId: input.agentId,
    reason: input.reason,
    severity: input.severity || "MEDIUM",
    requestedAction: input.requestedAction || "REVIEW",
    contextSummary: String(input.contextSummary || "").slice(0, 2000),
    assignedUserId: null,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolution: null,
    metadata: {}
  };
  multiAgentStore(input.companyId).putIntervention(item);
  recordMultiAgentMetric("humanInterventions");
  emitMultiAgentEvent(
    input.companyId,
    "AGENT_HUMAN_INTERVENTION_REQUESTED",
    item.id
  );
  return item;
}

export function isolateAgentFailure(input: {
  companyId: number;
  agentId: string;
  sessionId?: string;
  reason: string;
}) {
  const store = multiAgentStore(input.companyId);
  const agent = defaultAgentRegistry.getById(input.companyId, input.agentId);
  if (!agent) throw new Error("ERR_AGENT_NOT_FOUND");
  const updated = {
    ...agent,
    status: "DEGRADED" as const,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...agent.metadata,
      lastFailureReason: input.reason,
      isolatedSessionId: input.sessionId || null
    }
  };
  store.putAgent(updated);
  emitMultiAgentEvent(input.companyId, "AGENT_FAILURE_ISOLATED", agent.id, {
    reason: input.reason
  });
  return {
    agent: updated,
    isolated: true,
    kernelIntact: true,
    otherAgentsIntact: true
  };
}

export default {
  createCoordinationPlan,
  simulateCoordination,
  validateAgentMessage,
  checkAgentHealth,
  evaluateFallbackSafety,
  createHumanIntervention,
  isolateAgentFailure
};
