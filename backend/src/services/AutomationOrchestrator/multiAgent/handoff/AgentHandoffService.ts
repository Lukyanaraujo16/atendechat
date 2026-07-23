import { createHash } from "crypto";
import { getMultiAgentConfig } from "../MultiAgentConfig";
import { multiAgentStore } from "../stores/MultiAgentStore";
import { defaultAgentRegistry } from "../registry/AgentRegistry";
import { buildContextBoundary } from "../context/AgentContextBuilder";
import { detectDelegationLoop } from "../delegation/AgentDelegationService";
import { emitMultiAgentEvent } from "../MultiAgentEvents";
import { recordMultiAgentMetric, recordMultiAgentAudit } from "../metrics/MultiAgentMetrics";
import {
  AgentHandoffRequest,
  AgentHandoffResult,
  AgentStickyAssignment
} from "../types";
import { HandoffType } from "../../../../config/automationMultiAgentConstants";

function hid(seed: string): string {
  return `hof_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

export function evaluateHandoffPolicy(input: {
  companyId: number;
  request: AgentHandoffRequest;
  approved?: boolean;
  handoffCount?: number;
}): {
  approved: boolean;
  targetAgentId: string | null;
  violations: string[];
  warnings: string[];
  reasonCodes: string[];
  executionMode: "SIMULATION" | "SHADOW" | "CONFIRMATION_REQUIRED" | "BLOCKED";
} {
  const cfg = getMultiAgentConfig(input.companyId);
  const violations: string[] = [];
  const warnings: string[] = [];

  if (!cfg.handoffEnabled) violations.push("ERR_AGENT_HANDOFF_DISABLED");
  if (cfg.liveIntegrationEnabled) violations.push("ERR_AGENT_LIVE_NOT_ENABLED");

  const source = defaultAgentRegistry.getById(
    input.companyId,
    input.request.sourceAgentId
  );
  if (!source) violations.push("ERR_AGENT_NOT_FOUND");
  if (source && !source.handoffPolicy.enabled) {
    violations.push("ERR_AGENT_HANDOFF_DISABLED");
  }
  if (
    (input.handoffCount ?? 0) >=
    Math.min(cfg.maxHandoffsPerSession, source?.handoffPolicy.maxPerSession ?? 3)
  ) {
    violations.push("ERR_AGENT_HANDOFF_LIMIT_EXCEEDED");
  }

  let targetId = input.request.requestedTargetAgentId;
  let target = targetId
    ? defaultAgentRegistry.getById(input.companyId, targetId)
    : defaultAgentRegistry.resolveDefault(input.companyId);

  if (target && target.id === input.request.sourceAgentId) {
    const loop = detectDelegationLoop({
      sourceAgentId: input.request.sourceAgentId,
      targetAgentId: target.id,
      chain: [input.request.sourceAgentId],
      task: input.request.goal,
      previousTasks: []
    });
    if (loop === "LOOP_DETECTED") violations.push("ERR_AGENT_HANDOFF_LOOP");
  }

  if (!target || target.status !== "ACTIVE") {
    violations.push("ERR_AGENT_NO_CANDIDATE");
    target = null;
    targetId = null;
  } else {
    targetId = target.id;
  }

  const requiresApproval =
    cfg.requireApprovalForHandoff ||
    source?.handoffPolicy.requireHumanApproval ||
    input.request.requiresHumanApproval;

  let executionMode: "SIMULATION" | "SHADOW" | "CONFIRMATION_REQUIRED" | "BLOCKED" =
    "SIMULATION";
  if (violations.length) executionMode = "BLOCKED";
  else if (requiresApproval && !input.approved) executionMode = "CONFIRMATION_REQUIRED";
  else if (cfg.handoffSimulationOnly) executionMode = "SIMULATION";
  else executionMode = "SHADOW";

  return {
    approved: violations.length === 0 && (!requiresApproval || input.approved === true),
    targetAgentId: targetId,
    violations,
    warnings,
    reasonCodes: violations,
    executionMode
  };
}

export function simulateHandoff(input: {
  companyId: number;
  userId?: number | null;
  body: Partial<AgentHandoffRequest> & {
    sourceAgentId: string;
    sourceSessionId: string;
  };
  approved?: boolean;
  handoffCount?: number;
}) {
  const store = multiAgentStore(input.companyId);
  const request: AgentHandoffRequest = {
    id: hid(`${input.companyId}:${Date.now()}`),
    companyId: input.companyId,
    sourceAgentId: input.body.sourceAgentId,
    sourceSessionId: input.body.sourceSessionId,
    requestedTargetAgentId: input.body.requestedTargetAgentId ?? null,
    reason: String(input.body.reason || "handoff"),
    reasonCode: String(input.body.reasonCode || "SPECIALIST_NEEDED"),
    goal: String(input.body.goal || ""),
    handoffType: (input.body.handoffType as HandoffType) || "CONTEXTUAL_HANDOFF",
    contextSharingLevel: input.body.contextSharingLevel || "TASK_ONLY",
    preserveStickyAssignment: input.body.preserveStickyAssignment !== false,
    requiresHumanApproval: input.body.requiresHumanApproval !== false,
    createdAt: new Date().toISOString(),
    metadata: input.body.metadata || {}
  };
  store.putHandoff(request);
  recordMultiAgentMetric("handoffsRequested");
  emitMultiAgentEvent(input.companyId, "AGENT_HANDOFF_REQUESTED", request.id);

  const decision = evaluateHandoffPolicy({
    companyId: input.companyId,
    request,
    approved: input.approved,
    handoffCount: input.handoffCount
  });

  if (!decision.approved || !decision.targetAgentId) {
    recordMultiAgentMetric("handoffsFailed");
    emitMultiAgentEvent(input.companyId, "AGENT_HANDOFF_FAILED", request.id, {
      reasonCodes: decision.reasonCodes
    });
    return { request, decision, result: null as AgentHandoffResult | null };
  }

  emitMultiAgentEvent(input.companyId, "AGENT_HANDOFF_APPROVED", request.id);
  const boundary = buildContextBoundary({
    companyId: input.companyId,
    sourceAgentId: request.sourceAgentId,
    targetAgentId: decision.targetAgentId,
    sourceSessionId: request.sourceSessionId,
    sharingLevel: request.contextSharingLevel,
    goal: request.goal,
    task: request.reason
  });

  let stickyUpdated = false;
  if (request.preserveStickyAssignment) {
    const sticky: AgentStickyAssignment = {
      id: hid(`sticky:${request.sourceSessionId}`),
      companyId: input.companyId,
      scopeType: "ticketId",
      scopeId: String(request.metadata.ticketId || request.sourceSessionId),
      agentId: decision.targetAgentId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + getMultiAgentConfig(input.companyId).stickyAssignmentTtlMs
      ).toISOString(),
      lastUsedAt: new Date().toISOString(),
      reason: "handoff",
      metadata: {}
    };
    store.putSticky(sticky);
    stickyUpdated = true;
  }

  const result: AgentHandoffResult = {
    id: hid(`res:${request.id}`),
    companyId: input.companyId,
    sourceAgentId: request.sourceAgentId,
    targetAgentId: decision.targetAgentId,
    sourceSessionId: request.sourceSessionId,
    targetSessionId: `sess_${decision.targetAgentId}_${Date.now()}`,
    handoffType: request.handoffType,
    status: "SIMULATED",
    contextBoundaryId: boundary.id,
    stickyAssignmentUpdated: stickyUpdated,
    reasonCodes: ["simulated_handoff"],
    warnings: decision.warnings,
    createdAt: new Date().toISOString(),
    metadata: {
      executionMode: decision.executionMode,
      liveIntegrationEnabled: false
    }
  };
  store.putHandoffResult(result);
  recordMultiAgentMetric("handoffsCompleted");
  emitMultiAgentEvent(input.companyId, "AGENT_HANDOFF_COMPLETED", result.id);
  recordMultiAgentAudit({
    companyId: input.companyId,
    userId: input.userId ?? null,
    agentId: decision.targetAgentId,
    sourceAgentId: request.sourceAgentId,
    targetAgentId: decision.targetAgentId,
    agentVersion: null,
    rootSessionId: request.sourceSessionId,
    sessionId: request.sourceSessionId,
    childSessionId: result.targetSessionId,
    routingDecisionId: null,
    delegationRequestId: null,
    handoffRequestId: request.id,
    coordinationPlanId: null,
    action: "handoff_simulate",
    previousState: request.sourceAgentId,
    newState: decision.targetAgentId,
    reasonCodes: result.reasonCodes,
    contextBoundarySummary: boundary.id,
    approvalMode: input.approved ? "ADMIN_CONFIRMED" : "SIMULATION",
    timestamp: result.createdAt,
    metadataSanitized: { handoffType: request.handoffType }
  });

  return { request, decision, result, boundary };
}

export default { evaluateHandoffPolicy, simulateHandoff };
