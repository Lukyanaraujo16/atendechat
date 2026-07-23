import { createHash } from "crypto";
import { getMultiAgentConfig } from "../MultiAgentConfig";
import { multiAgentStore } from "../stores/MultiAgentStore";
import { defaultAgentRegistry } from "../registry/AgentRegistry";
import { resolveAgentToolBoundary } from "../policies/AgentToolBoundaryResolver";
import { emitMultiAgentEvent } from "../MultiAgentEvents";
import {
  recordMultiAgentMetric,
  recordMultiAgentAudit
} from "../metrics/MultiAgentMetrics";
import {
  AgentAvailabilityState,
  AgentProfile,
  AgentRoutingContext,
  AgentSelectionDecision,
  RejectedAgentCandidate
} from "../types";
import {
  AgentSpecialization,
  RoutingSourceType,
  SelectionStrategy
} from "../../../../config/automationMultiAgentConstants";

function rid(seed: string): string {
  return `rtg_${createHash("sha256")
    .update(`${seed}:${Math.random()}:${process.hrtime.bigint()}`)
    .digest("hex")
    .slice(0, 12)}`;
}

export function evaluateAvailability(input: {
  agent: AgentProfile;
  activeSessions?: number;
  nowHour?: number;
}): { state: AgentAvailabilityState; reasonCodes: string[] } {
  const reasons: string[] = [];
  if (input.agent.status === "SUSPENDED") {
    return { state: "SUSPENDED", reasonCodes: ["suspended"] };
  }
  if (input.agent.status === "DEGRADED") {
    return { state: "DEGRADED", reasonCodes: ["degraded"] };
  }
  if (input.agent.status !== "ACTIVE" || !input.agent.enabled) {
    return { state: "UNAVAILABLE", reasonCodes: ["not_active"] };
  }
  const max = input.agent.executionLimits.maxConcurrentSessions;
  const active = input.activeSessions ?? 0;
  if (active >= max) {
    return { state: "AT_CAPACITY", reasonCodes: ["at_capacity"] };
  }
  if (input.agent.workingHours) {
    const hour = input.nowHour ?? new Date().getHours();
    if (
      hour < input.agent.workingHours.startHour ||
      hour >= input.agent.workingHours.endHour
    ) {
      return {
        state: "OUTSIDE_WORKING_HOURS",
        reasonCodes: ["outside_working_hours"]
      };
    }
  }
  if (active > 0) reasons.push("busy_soft");
  return {
    state: active > 0 ? "BUSY" : "AVAILABLE",
    reasonCodes: reasons
  };
}

export function scoreAgent(input: {
  companyId: number;
  agent: AgentProfile;
  context: AgentRoutingContext;
  stickyMatch: boolean;
  availability: AgentAvailabilityState;
}): { score: number; reasons: string[] } {
  const w = getMultiAgentConfig(input.companyId).selectionWeights;
  const reasons: string[] = [];
  let score = 0;

  const caps = input.context.requiredCapabilities || [];
  const capMatch = caps.length
    ? caps.filter(c => input.agent.capabilities.includes(c)).length / caps.length
    : 0.5;
  score += capMatch * w.capability;
  if (capMatch === 1) reasons.push("capability_full_match");

  const spec =
    !input.context.preferredSpecialization ||
    input.agent.specialization === input.context.preferredSpecialization ||
    input.agent.specialization === "GENERAL"
      ? 1
      : 0.2;
  score += spec * w.specialization;

  const channel =
    !input.context.channel ||
    !input.agent.channelPolicy.channels.length ||
    input.agent.channelPolicy.channels.includes(input.context.channel)
      ? 1
      : 0;
  score += channel * w.channel;

  const queue =
    input.context.queueId == null
      ? 0.5
      : input.agent.queueIds.includes(input.context.queueId)
        ? 1
        : input.agent.queueIds.length
          ? 0
          : 0.35;
  score += queue * w.queue;
  if (queue === 1) reasons.push("queue_match");

  const whatsapp =
    input.context.whatsappId == null
      ? 0.5
      : input.agent.whatsappIds.includes(input.context.whatsappId)
        ? 1
        : input.agent.whatsappIds.length
          ? 0
          : 0.35;
  score += whatsapp * (w.channel || 1) * 0.5;
  if (whatsapp === 1) reasons.push("whatsapp_match");

  const lang =
    !input.context.language || input.agent.language === input.context.language
      ? 1
      : 0.4;
  score += lang * w.language;

  const avail =
    input.availability === "AVAILABLE"
      ? 1
      : input.availability === "BUSY"
        ? 0.6
        : 0;
  score += avail * w.availability;

  const priorityScore = Math.max(0, 1 - input.agent.priority / 1000);
  score += priorityScore * w.priority;

  const health = input.agent.status === "ACTIVE" ? 1 : 0;
  score += health * w.health;

  if (input.stickyMatch) {
    score += w.sticky;
    reasons.push("sticky_match");
  }

  return { score: Number(score.toFixed(4)), reasons };
}

/**
 * AgentSelectionEngine — determinístico, sem LLM.
 */
export function selectAgent(input: {
  companyId: number;
  context: AgentRoutingContext;
  userId?: number | null;
}): AgentSelectionDecision {
  const cfg = getMultiAgentConfig(input.companyId);
  const started = Date.now();
  recordMultiAgentMetric("routingRequests");
  emitMultiAgentEvent(
    input.companyId,
    "AGENT_ROUTING_STARTED",
    input.context.id
  );

  const store = multiAgentStore(input.companyId);
  const idemKey = `select:${input.companyId}:${input.context.id}`;
  const existingId = store.getIdempotency(idemKey);
  if (existingId) {
    const existing = store.getSelection(existingId);
    if (existing) return existing;
  }

  const rejected: RejectedAgentCandidate[] = [];
  const candidates: Array<{
    agent: AgentProfile;
    score: number;
    strategy: SelectionStrategy;
    reasons: string[];
  }> = [];

  const strategies = cfg.defaultSelectionStrategies;
  const all = defaultAgentRegistry.findCandidates({
    companyId: input.companyId,
    capabilities: input.context.requiredCapabilities,
    specialization: input.context.preferredSpecialization,
    channel: input.context.channel,
    queueId: input.context.queueId,
    whatsappId: input.context.whatsappId,
    language: input.context.language,
    onlySelectable: false
  });

  const sticky = store.listSticky().find(s => {
    if (s.companyId !== input.companyId) return false;
    if (new Date(s.expiresAt).getTime() < Date.now()) return false;
    if (
      s.scopeType === "contactId" &&
      input.context.contactId != null &&
      s.scopeId === String(input.context.contactId)
    )
      return true;
    if (
      s.scopeType === "ticketId" &&
      input.context.ticketId != null &&
      s.scopeId === String(input.context.ticketId)
    )
      return true;
    return false;
  });

  for (const agent of all) {
    const availability = evaluateAvailability({ agent });
    const boundary = resolveAgentToolBoundary({
      companyId: input.companyId,
      agent
    });
    const missing = (input.context.requiredCapabilities || []).filter(
      c =>
        agent.capabilities.length > 0 &&
        !agent.capabilities.includes(c) &&
        !boundary.allowedCapabilities.includes(c)
    );

    if (agent.status !== "ACTIVE" || !agent.enabled) {
      rejected.push({
        agentId: agent.id,
        reasonCodes: ["not_selectable", `status:${agent.status}`],
        missingCapabilities: missing,
        blockedCapabilities: [],
        policyViolations: [],
        availabilityState: availability.state,
        score: 0,
        metadata: {}
      });
      continue;
    }
    if (
      ["AT_CAPACITY", "OUTSIDE_WORKING_HOURS", "SUSPENDED", "UNAVAILABLE"].includes(
        availability.state
      )
    ) {
      rejected.push({
        agentId: agent.id,
        reasonCodes: availability.reasonCodes,
        missingCapabilities: missing,
        blockedCapabilities: [],
        policyViolations: [],
        availabilityState: availability.state,
        score: 0,
        metadata: {}
      });
      continue;
    }
    if (missing.length && agent.capabilities.length) {
      rejected.push({
        agentId: agent.id,
        reasonCodes: ["missing_capabilities"],
        missingCapabilities: missing,
        blockedCapabilities: [],
        policyViolations: [],
        availabilityState: availability.state,
        score: 0,
        metadata: {}
      });
      continue;
    }

    const scored = scoreAgent({
      companyId: input.companyId,
      agent,
      context: input.context,
      stickyMatch: sticky?.agentId === agent.id,
      availability: availability.state
    });

    let strategy: SelectionStrategy = "PRIORITY";
    if (
      input.context.requestedAgentId === agent.id &&
      strategies.includes("EXPLICIT_AGENT")
    ) {
      strategy = "EXPLICIT_AGENT";
      scored.score += 1;
      scored.reasons.push("explicit_request");
    } else if (sticky?.agentId === agent.id) {
      strategy = "STICKY_AGENT";
    } else if (
      input.context.queueId != null &&
      agent.queueIds.includes(input.context.queueId)
    ) {
      strategy = "QUEUE_AGENT";
      scored.score += 0.5;
      scored.reasons.push("queue_agent");
    } else if (
      input.context.whatsappId != null &&
      agent.whatsappIds.includes(input.context.whatsappId)
    ) {
      strategy = "CHANNEL_AGENT";
      scored.score += 0.5;
      scored.reasons.push("channel_whatsapp");
    } else if (
      input.context.channel &&
      agent.channelPolicy.channels.includes(input.context.channel)
    ) {
      strategy = "CHANNEL_AGENT";
      scored.score += 0.4;
    } else if (
      (input.context.requiredCapabilities || []).every(c =>
        agent.capabilities.includes(c)
      ) &&
      (input.context.requiredCapabilities || []).length
    ) {
      strategy = "CAPABILITY_MATCH";
    } else if (
      input.context.preferredSpecialization &&
      agent.specialization === input.context.preferredSpecialization
    ) {
      strategy = "SPECIALIZATION_MATCH";
    } else if (agent.isDefault) {
      strategy = "DEFAULT_AGENT";
    } else if (agent.isCoordinator || agent.role === "COORDINATOR") {
      strategy = "COORDINATOR";
    }

    candidates.push({
      agent,
      score: scored.score,
      strategy,
      reasons: scored.reasons
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.agent.priority - b.agent.priority);

  let selected = candidates[0] || null;
  const stickyPreferred = candidates.find(c => c.strategy === "STICKY_AGENT");
  const explicitPreferred = candidates.find(c => c.strategy === "EXPLICIT_AGENT");
  if (explicitPreferred) {
    selected = explicitPreferred;
  } else if (stickyPreferred) {
    selected = stickyPreferred;
  } else if (input.context.queueId != null) {
    const queuePreferred = candidates.find(c => c.strategy === "QUEUE_AGENT");
    if (queuePreferred) selected = queuePreferred;
  } else if (input.context.whatsappId != null || input.context.channel) {
    const channelPreferred = candidates.find(c => c.strategy === "CHANNEL_AGENT");
    if (channelPreferred) selected = channelPreferred;
  } else if (
    input.context.preferredSpecialization &&
    !input.context.requestedAgentId
  ) {
    const specPreferred = candidates.find(
      c => c.strategy === "SPECIALIZATION_MATCH"
    );
    if (specPreferred) selected = specPreferred;
  }

  let fallbackAgentId: string | null = null;
  const warnings: string[] = [];

  if (!selected) {
    const def = defaultAgentRegistry.resolveDefault(input.companyId);
    if (def) {
      selected = {
        agent: def,
        score: 0.1,
        strategy: "FALLBACK",
        reasons: ["fallback_default"]
      };
      fallbackAgentId = def.id;
      warnings.push("no_primary_candidate_used_default");
      recordMultiAgentMetric("fallbacks");
      emitMultiAgentEvent(input.companyId, "AGENT_FALLBACK_SELECTED", def.id);
    }
  }

  const decision: AgentSelectionDecision = {
    id: rid(`${input.companyId}:${input.context.id}:${Date.now()}`),
    companyId: input.companyId,
    routingContextId: input.context.id,
    selectedAgentId: selected?.agent.id || null,
    selectedAgentVersion: selected?.agent.version || null,
    candidateAgentIds: candidates.map(c => c.agent.id),
    rejectedCandidates: rejected,
    selectionStrategy: selected?.strategy || null,
    score: selected?.score || 0,
    confidence: selected ? Math.min(0.99, 0.4 + selected.score * 0.5) : 0,
    reasonCodes: selected?.reasons || ["ERR_AGENT_NO_CANDIDATE"],
    warnings,
    fallbackAgentId,
    requiresHumanReview: !selected || selected.strategy === "FALLBACK",
    createdAt: new Date().toISOString(),
    metadata: {
      liveIntegrationEnabled: false,
      generativeAiUsed: false,
      latencyMs: Date.now() - started
    }
  };

  store.putSelection(decision);
  store.claimIdempotency(idemKey, decision.id);
  recordMultiAgentMetric("routingLatencySum", Date.now() - started);

  if (decision.selectedAgentId) {
    recordMultiAgentMetric("routingSuccesses", 1, {
      agentId: decision.selectedAgentId,
      strategy: decision.selectionStrategy || undefined
    });
    emitMultiAgentEvent(input.companyId, "AGENT_SELECTED", decision.selectedAgentId, {
      strategy: decision.selectionStrategy,
      score: decision.score
    });
  } else {
    recordMultiAgentMetric("routingFailures");
    emitMultiAgentEvent(input.companyId, "AGENT_SELECTION_FAILED", input.context.id);
  }

  emitMultiAgentEvent(input.companyId, "AGENT_ROUTING_COMPLETED", decision.id);
  recordMultiAgentAudit({
    companyId: input.companyId,
    userId: input.userId ?? null,
    agentId: decision.selectedAgentId,
    sourceAgentId: input.context.currentAgentId,
    targetAgentId: decision.selectedAgentId,
    agentVersion: decision.selectedAgentVersion,
    rootSessionId: null,
    sessionId: null,
    childSessionId: null,
    routingDecisionId: decision.id,
    delegationRequestId: null,
    handoffRequestId: null,
    coordinationPlanId: null,
    action: "select",
    previousState: null,
    newState: decision.selectedAgentId,
    reasonCodes: decision.reasonCodes,
    contextBoundarySummary: "",
    approvalMode: null,
    timestamp: decision.createdAt,
    metadataSanitized: {
      strategy: decision.selectionStrategy,
      rejected: rejected.length
    }
  });

  return decision;
}

export function buildRoutingContext(input: {
  companyId: number;
  id?: string;
  sourceType?: RoutingSourceType;
  channel?: string | null;
  whatsappId?: number | null;
  queueId?: number | null;
  ticketId?: number | null;
  contactId?: number | null;
  goalId?: string | null;
  goalType?: string | null;
  requiredCapabilities?: string[];
  preferredSpecialization?: AgentSpecialization | null;
  language?: string | null;
  priority?: number;
  currentAgentId?: string | null;
  requestedAgentId?: string | null;
  humanUserId?: number | null;
  metadata?: Record<string, unknown>;
}): AgentRoutingContext {
  const ctx: AgentRoutingContext = {
    id: input.id || rid(`ctx:${input.companyId}:${Date.now()}`),
    companyId: input.companyId,
    sourceType: input.sourceType || "ADMIN_SIMULATION",
    channel: input.channel ?? null,
    whatsappId: input.whatsappId ?? null,
    queueId: input.queueId ?? null,
    ticketId: input.ticketId ?? null,
    contactId: input.contactId ?? null,
    goalId: input.goalId ?? null,
    goalType: input.goalType ?? null,
    requiredCapabilities: input.requiredCapabilities || [],
    preferredSpecialization: input.preferredSpecialization ?? null,
    language: input.language ?? null,
    priority: input.priority ?? 100,
    currentAgentId: input.currentAgentId ?? null,
    requestedAgentId: input.requestedAgentId ?? null,
    humanUserId: input.humanUserId ?? null,
    timestamp: new Date().toISOString(),
    metadata: input.metadata || {}
  };
  multiAgentStore(input.companyId).putRoutingContext(ctx);
  return ctx;
}

export function routeAndSelect(input: {
  companyId: number;
  userId?: number | null;
  body: Record<string, unknown>;
}): { context: AgentRoutingContext; decision: AgentSelectionDecision } {
  const cfg = getMultiAgentConfig(input.companyId);
  if (!cfg.routingEnabled) throw new Error("ERR_AGENT_SELECTION_FAILED");
  if (cfg.liveIntegrationEnabled) throw new Error("ERR_AGENT_LIVE_NOT_ENABLED");

  const context = buildRoutingContext({
    companyId: input.companyId,
    id: (input.body.id as string) || undefined,
    sourceType: (input.body.sourceType as RoutingSourceType) || "ADMIN_SIMULATION",
    channel: (input.body.channel as string) || null,
    whatsappId: input.body.whatsappId != null ? Number(input.body.whatsappId) : null,
    queueId: input.body.queueId != null ? Number(input.body.queueId) : null,
    ticketId: input.body.ticketId != null ? Number(input.body.ticketId) : null,
    contactId: input.body.contactId != null ? Number(input.body.contactId) : null,
    goalId: (input.body.goalId as string) || null,
    goalType: (input.body.goalType as string) || null,
    requiredCapabilities: (input.body.requiredCapabilities as string[]) || [],
    preferredSpecialization:
      (input.body.preferredSpecialization as AgentSpecialization) || null,
    language: (input.body.language as string) || null,
    priority: Number(input.body.priority || 100),
    currentAgentId: (input.body.currentAgentId as string) || null,
    requestedAgentId: (input.body.requestedAgentId as string) || null,
    humanUserId: input.userId ?? null,
    metadata: (input.body.metadata as Record<string, unknown>) || {}
  });
  const decision = selectAgent({
    companyId: input.companyId,
    context,
    userId: input.userId
  });
  return { context, decision };
}

export default { selectAgent, buildRoutingContext, routeAndSelect, evaluateAvailability, scoreAgent };
