import { createHash } from "crypto";
import { getMultiAgentConfig } from "../MultiAgentConfig";
import { multiAgentStore } from "../stores/MultiAgentStore";
import { defaultAgentRegistry } from "../registry/AgentRegistry";
import { resolveAgentToolBoundary } from "../policies/AgentToolBoundaryResolver";
import { buildContextBoundary } from "../context/AgentContextBuilder";
import { emitMultiAgentEvent } from "../MultiAgentEvents";
import { recordMultiAgentMetric, recordMultiAgentAudit } from "../metrics/MultiAgentMetrics";
import {
  AgentDelegationPolicyDecision,
  AgentDelegationRequest,
  AgentDelegationResult,
  DelegatedExecutionSession,
  MultiAgentSessionContext
} from "../types";
import {
  AgentSpecialization,
  LoopDecision
} from "../../../../config/automationMultiAgentConstants";
import { CognitiveMemoryEngine } from "../../cognitive/memory/CognitiveMemoryEngine";
import { KnowledgeObject } from "../../cognitive/memory/memoryTypes";

function did(seed: string): string {
  return `dlg_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

export function detectDelegationLoop(input: {
  sourceAgentId: string;
  targetAgentId: string;
  chain: string[];
  task: string;
  previousTasks: string[];
}): LoopDecision {
  if (input.sourceAgentId === input.targetAgentId) return "LOOP_DETECTED";
  const next = [...input.chain, input.targetAgentId];
  if (next.filter(id => id === input.targetAgentId).length > 1) {
    return "LOOP_DETECTED";
  }
  // A→B→A
  if (
    input.chain.includes(input.targetAgentId) &&
    input.chain[input.chain.length - 1] === input.sourceAgentId
  ) {
    return "LOOP_DETECTED";
  }
  if (
    input.previousTasks.filter(t => t === input.task).length >= 2
  ) {
    return "POSSIBLE_LOOP";
  }
  if (input.chain.length >= 2 && input.chain.includes(input.targetAgentId)) {
    return "POSSIBLE_LOOP";
  }
  return "SAFE";
}

export function evaluateDelegationPolicy(input: {
  companyId: number;
  request: AgentDelegationRequest;
  parentSession?: MultiAgentSessionContext | null;
  approved?: boolean;
}): AgentDelegationPolicyDecision {
  const cfg = getMultiAgentConfig(input.companyId);
  const violations: string[] = [];
  const warnings: string[] = [];
  const reasonCodes: string[] = [];

  if (!cfg.delegationEnabled) {
    return {
      approved: false,
      executionMode: "BLOCKED",
      requiresConfirmation: true,
      selectedTargetAgentId: null,
      allowedContextScopes: [],
      blockedContextScopes: ["AGENT_PRIVATE", "TENANT_SHARED"],
      effectiveMaxDepth: 0,
      effectiveTimeout: cfg.delegationTimeoutMs,
      violations: ["delegation_disabled"],
      warnings: [],
      reasonCodes: ["ERR_AGENT_DELEGATION_DISABLED"],
      loopDecision: "SAFE",
      metadata: {}
    };
  }

  const source = defaultAgentRegistry.getById(
    input.companyId,
    input.request.sourceAgentId
  );
  if (!source) violations.push("ERR_AGENT_NOT_FOUND");
  if (source && (source.status !== "ACTIVE" || !source.enabled)) {
    violations.push("ERR_AGENT_INACTIVE");
  }
  if (!source?.delegationPolicy.enabled) {
    violations.push("ERR_AGENT_DELEGATION_DISABLED");
  }

  let targetId = input.request.requestedTargetAgentId;
  let target = targetId
    ? defaultAgentRegistry.getById(input.companyId, targetId)
    : null;

  if (!target && input.request.requiredSpecialization) {
    target =
      defaultAgentRegistry
        .findCandidates({
          companyId: input.companyId,
          specialization: input.request.requiredSpecialization,
          capabilities: input.request.requiredCapabilities,
          onlySelectable: true
        })
        .find(a => a.id !== input.request.sourceAgentId) || null;
    targetId = target?.id || null;
  }

  if (!target) {
    violations.push("ERR_AGENT_NO_CANDIDATE");
  } else if (target.companyId !== input.companyId) {
    violations.push("ERR_AGENT_TENANT_FORBIDDEN");
  } else if (target.status !== "ACTIVE") {
    violations.push("ERR_AGENT_INACTIVE");
  }

  const depth = (input.parentSession?.delegationDepth ?? 0) + 1;
  const maxDepth = Math.min(
    cfg.maxDelegationDepth,
    source?.delegationPolicy.maxDepth ?? cfg.maxDelegationDepth,
    input.request.maxDepth
  );
  if (depth > maxDepth) {
    violations.push("ERR_AGENT_DELEGATION_DEPTH_EXCEEDED");
  }

  const parentDelegations = multiAgentStore(input.companyId)
    .listDelegations()
    .filter(d => d.sourceSessionId === input.request.sourceSessionId);
  if (parentDelegations.length >= cfg.maxDelegationsPerSession) {
    violations.push("ERR_AGENT_DELEGATION_LIMIT_EXCEEDED");
  }

  const chain = input.parentSession
    ? [
        input.parentSession.agentId,
        input.parentSession.delegatedByAgentId || ""
      ].filter(Boolean)
    : [input.request.sourceAgentId];
  const loopDecision = cfg.loopDetectionEnabled
    ? detectDelegationLoop({
        sourceAgentId: input.request.sourceAgentId,
        targetAgentId: targetId || "unknown",
        chain,
        task: input.request.task,
        previousTasks: parentDelegations.map(d => d.task)
      })
    : "SAFE";

  if (loopDecision === "LOOP_DETECTED") {
    violations.push("ERR_AGENT_DELEGATION_LOOP");
    recordMultiAgentMetric("loopsDetected");
    emitMultiAgentEvent(input.companyId, "AGENT_LOOP_DETECTED", input.request.id);
  } else if (loopDecision === "POSSIBLE_LOOP") {
    warnings.push("possible_loop_requires_review");
  }

  if (target && input.request.requiredCapabilities.length) {
    const boundary = resolveAgentToolBoundary({
      companyId: input.companyId,
      agent: target
    });
    for (const cap of input.request.requiredCapabilities) {
      if (
        boundary.allowedCapabilities.length &&
        !boundary.allowedCapabilities.includes(cap) &&
        target.capabilities.length &&
        !target.capabilities.includes(cap)
      ) {
        violations.push("ERR_AGENT_CAPABILITY_NOT_ALLOWED");
      }
    }
  }

  const requiresConfirmation =
    cfg.requireApprovalForDelegation ||
    source?.delegationPolicy.requireConfirmation !== false ||
    input.request.requiresConfirmation ||
    loopDecision === "POSSIBLE_LOOP";

  let executionMode: AgentDelegationPolicyDecision["executionMode"] = "SIMULATION";
  if (violations.length) executionMode = "BLOCKED";
  else if (requiresConfirmation && !input.approved) {
    executionMode = "CONFIRMATION_REQUIRED";
  } else if (cfg.delegationSimulationOnly) {
    executionMode = "SIMULATION";
  } else {
    executionMode = "SHADOW";
  }

  // Live always blocked
  if (cfg.liveIntegrationEnabled) {
    violations.push("ERR_AGENT_LIVE_NOT_ENABLED");
    executionMode = "BLOCKED";
  }

  const approved =
    violations.length === 0 &&
    (executionMode === "SIMULATION" ||
      executionMode === "SHADOW" ||
      (executionMode === "CONFIRMATION_REQUIRED" && input.approved === true));

  if (!approved && executionMode === "CONFIRMATION_REQUIRED" && !input.approved) {
    reasonCodes.push("confirmation_required");
  }

  return {
    approved: approved && !!targetId,
    executionMode,
    requiresConfirmation,
    selectedTargetAgentId: targetId,
    allowedContextScopes: input.request.allowedContextScopes.length
      ? input.request.allowedContextScopes
      : ["EXECUTION_SCOPED"],
    blockedContextScopes: [
      "AGENT_PRIVATE",
      ...(input.request.forbiddenContextScopes || [])
    ],
    effectiveMaxDepth: maxDepth,
    effectiveTimeout: cfg.delegationTimeoutMs,
    violations,
    warnings,
    reasonCodes: [...reasonCodes, ...violations],
    loopDecision,
    metadata: {
      depth,
      simulationOnly: true,
      liveIntegrationEnabled: false
    }
  };
}

export async function simulateDelegation(input: {
  companyId: number;
  userId?: number | null;
  request: Omit<AgentDelegationRequest, "id" | "createdAt" | "companyId"> & {
    companyId?: number;
  };
  approved?: boolean;
  parentSession?: MultiAgentSessionContext | null;
  persistKnowledge?: boolean;
}): Promise<{
  request: AgentDelegationRequest;
  decision: AgentDelegationPolicyDecision;
  boundary: ReturnType<typeof buildContextBoundary> | null;
  childSession: DelegatedExecutionSession | null;
  result: AgentDelegationResult | null;
  knowledgeObject: KnowledgeObject | null;
}> {
  const cfg = getMultiAgentConfig(input.companyId);
  const store = multiAgentStore(input.companyId);
  const request: AgentDelegationRequest = {
    id: did(`${input.companyId}:${Date.now()}`),
    companyId: input.companyId,
    sourceAgentId: input.request.sourceAgentId,
    sourceSessionId: input.request.sourceSessionId,
    rootSessionId: input.request.rootSessionId,
    requestedTargetAgentId: input.request.requestedTargetAgentId,
    requiredSpecialization: input.request.requiredSpecialization,
    requiredCapabilities: input.request.requiredCapabilities || [],
    goal: input.request.goal,
    task: input.request.task,
    expectedOutput: input.request.expectedOutput || "",
    contextReferences: input.request.contextReferences || [],
    allowedContextScopes: input.request.allowedContextScopes || ["EXECUTION_SCOPED"],
    forbiddenContextScopes: input.request.forbiddenContextScopes || ["AGENT_PRIVATE"],
    priority: input.request.priority ?? 100,
    deadline: input.request.deadline ?? null,
    maxDepth: input.request.maxDepth ?? cfg.maxDelegationDepth,
    requiresConfirmation: input.request.requiresConfirmation !== false,
    createdAt: new Date().toISOString(),
    metadata: input.request.metadata || {}
  };
  store.putDelegation(request);
  recordMultiAgentMetric("delegationsRequested");
  emitMultiAgentEvent(input.companyId, "AGENT_DELEGATION_REQUESTED", request.id);

  const decision = evaluateDelegationPolicy({
    companyId: input.companyId,
    request,
    parentSession: input.parentSession,
    approved: input.approved
  });

  if (!decision.approved) {
    recordMultiAgentMetric("delegationsBlocked");
    recordMultiAgentMetric("policyDenials");
    emitMultiAgentEvent(input.companyId, "AGENT_DELEGATION_BLOCKED", request.id, {
      reasonCodes: decision.reasonCodes
    });
    return {
      request,
      decision,
      boundary: null,
      childSession: null,
      result: null,
      knowledgeObject: null
    };
  }

  recordMultiAgentMetric("delegationsApproved");
  emitMultiAgentEvent(input.companyId, "AGENT_DELEGATION_APPROVED", request.id);

  const boundary = buildContextBoundary({
    companyId: input.companyId,
    sourceAgentId: request.sourceAgentId,
    targetAgentId: decision.selectedTargetAgentId!,
    sourceSessionId: request.sourceSessionId,
    sharingLevel: cfg.defaultContextSharingLevel,
    task: request.task,
    goal: request.goal
  });

  const now = new Date().toISOString();
  const childSession: DelegatedExecutionSession = {
    id: did(`child:${request.id}`),
    companyId: input.companyId,
    rootSessionId: request.rootSessionId,
    parentSessionId: request.sourceSessionId,
    sourceAgentId: request.sourceAgentId,
    targetAgentId: decision.selectedTargetAgentId!,
    delegationRequestId: request.id,
    contextBoundaryId: boundary.id,
    goal: request.goal,
    task: request.task,
    status: "COMPLETED",
    result: {
      simulated: true,
      output: `Simulated specialist result for: ${request.task}`,
      confidence: 0.75
    },
    startedAt: now,
    completedAt: now,
    timeoutAt: new Date(Date.now() + decision.effectiveTimeout).toISOString(),
    metadata: {
      environment: decision.executionMode,
      liveIntegrationEnabled: false
    }
  };
  store.putDelegatedSession(childSession);
  recordMultiAgentMetric("childSessionsCreated");
  recordMultiAgentMetric("delegationsCompleted");
  emitMultiAgentEvent(input.companyId, "AGENT_DELEGATION_STARTED", childSession.id);
  emitMultiAgentEvent(input.companyId, "AGENT_DELEGATION_COMPLETED", childSession.id);

  const result: AgentDelegationResult = {
    id: did(`res:${request.id}`),
    companyId: input.companyId,
    delegationRequestId: request.id,
    sourceAgentId: request.sourceAgentId,
    targetAgentId: decision.selectedTargetAgentId!,
    childSessionId: childSession.id,
    status: "COMPLETED",
    output: String(childSession.result?.output || ""),
    structuredResult: childSession.result || {},
    knowledgeObjects: [],
    warnings: decision.warnings,
    errors: [],
    confidence: 0.75,
    adapterDecision: "ACCEPT_RESULT",
    startedAt: now,
    completedAt: now,
    metadata: { simulated: true }
  };
  store.putDelegationResult(result);

  let knowledgeObject: KnowledgeObject | null = null;
  if (input.persistKnowledge) {
    const memory = new CognitiveMemoryEngine();
    const ko: KnowledgeObject = {
      id: `kobj_${createHash("sha256").update(result.id).digest("hex").slice(0, 12)}`,
      memoryType: "EPISODIC",
      tenantId: input.companyId,
      agentId: Number.NaN as any,
      ticketId: null,
      contactId: null,
      goalId: null,
      executionId: childSession.id,
      title: "Delegation result",
      summary: result.output,
      content: JSON.stringify(result.structuredResult),
      entities: [
        { key: "sourceAgentId", value: request.sourceAgentId },
        { key: "targetAgentId", value: decision.selectedTargetAgentId! }
      ],
      tags: ["multi-agent", "delegation"],
      confidence: result.confidence,
      importance: 0.5,
      source: "multi_agent_delegation",
      version: 1,
      createdAt: now,
      updatedAt: now,
      metadata: {
        agentId: decision.selectedTargetAgentId,
        sourceAgentId: request.sourceAgentId,
        targetAgentId: decision.selectedTargetAgentId,
        sessionId: childSession.id,
        rootSessionId: request.rootSessionId,
        delegationId: request.id,
        scope: "EXECUTION_SCOPED"
      }
    };
    // agentId on KnowledgeObject is number | null - use null and put string ids in metadata
    ko.agentId = null;
    const saved = await memory.save(ko);
    knowledgeObject = saved.object;
    result.knowledgeObjects = [saved.object.id];
    store.putDelegationResult(result);
  }

  recordMultiAgentAudit({
    companyId: input.companyId,
    userId: input.userId ?? null,
    agentId: decision.selectedTargetAgentId,
    sourceAgentId: request.sourceAgentId,
    targetAgentId: decision.selectedTargetAgentId,
    agentVersion: null,
    rootSessionId: request.rootSessionId,
    sessionId: request.sourceSessionId,
    childSessionId: childSession.id,
    routingDecisionId: null,
    delegationRequestId: request.id,
    handoffRequestId: null,
    coordinationPlanId: null,
    action: "delegation_simulate",
    previousState: null,
    newState: "COMPLETED",
    reasonCodes: decision.reasonCodes,
    contextBoundarySummary: `level=${boundary.sharingLevel}; fields=${boundary.allowedFields.join(",")}`,
    approvalMode: input.approved ? "ADMIN_CONFIRMED" : "SIMULATION",
    timestamp: now,
    metadataSanitized: { executionMode: decision.executionMode }
  });

  return { request, decision, boundary, childSession, result, knowledgeObject };
}

export default {
  detectDelegationLoop,
  evaluateDelegationPolicy,
  simulateDelegation
};
