import { createHash } from "crypto";
import { getMultiAgentConfig } from "./MultiAgentConfig";
import { defaultAgentRegistry } from "./registry/AgentRegistry";
import {
  buildRoutingContext,
  routeAndSelect
} from "./selection/AgentSelectionEngine";
import { buildSpecializedAgentContext } from "./context/AgentContextBuilder";
import { simulateDelegation } from "./delegation/AgentDelegationService";
import { simulateHandoff } from "./handoff/AgentHandoffService";
import {
  checkAgentHealth,
  createCoordinationPlan,
  createHumanIntervention,
  evaluateFallbackSafety,
  isolateAgentFailure,
  simulateCoordination,
  validateAgentMessage
} from "./coordination/AgentCoordinatorService";
import { multiAgentStore } from "./stores/MultiAgentStore";
import { emitMultiAgentEvent, listMultiAgentEvents } from "./MultiAgentEvents";
import {
  getMultiAgentMetricsBase,
  listMultiAgentAudits
} from "./metrics/MultiAgentMetrics";
import { MultiAgentSessionContext } from "./types";

function sid(seed: string): string {
  return `mas_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

/**
 * MultiAgentEngine — fachada sobre o AgentOS compartilhado.
 */
export class MultiAgentEngine {
  async startSimulatedSession(input: {
    companyId: number;
    userId?: number | null;
    routingBody: Record<string, unknown>;
  }) {
    const cfg = getMultiAgentConfig(input.companyId);
    if (cfg.liveIntegrationEnabled) throw new Error("ERR_AGENT_LIVE_NOT_ENABLED");

    const { context, decision } = routeAndSelect({
      companyId: input.companyId,
      userId: input.userId,
      body: input.routingBody
    });
    if (!decision.selectedAgentId) throw new Error("ERR_AGENT_SELECTION_FAILED");

    const agent = defaultAgentRegistry.getById(
      input.companyId,
      decision.selectedAgentId
    )!;
    const specialized = buildSpecializedAgentContext({
      companyId: input.companyId,
      agent,
      routingDecisionId: decision.id,
      goalContext: String(input.routingBody.goalType || ""),
      userInput: String(input.routingBody.userInput || "")
    });

    const rootId = sid(`root:${Date.now()}`);
    const session: MultiAgentSessionContext = {
      companyId: input.companyId,
      sessionId: sid(`${input.companyId}:${agent.id}:${Date.now()}`),
      rootSessionId: rootId,
      parentSessionId: null,
      agentId: agent.id,
      agentVersion: agent.version,
      supervisorAgentId: null,
      delegatedByAgentId: null,
      delegationDepth: 0,
      handoffCount: 0,
      routingDecisionId: decision.id,
      contextBoundaryId: null,
      status: "RUNNING_SIMULATION",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        sharedKernel: true,
        liveIntegrationEnabled: false
      }
    };
    multiAgentStore(input.companyId).putSession(session);
    emitMultiAgentEvent(input.companyId, "AGENT_SESSION_STARTED", session.sessionId);
    return { context, decision, specialized, session, agent };
  }

  async runFullSimulationFlow(input: {
    companyId: number;
    userId?: number | null;
    routingBody?: Record<string, unknown>;
    delegationTask?: string;
  }) {
    const started = await this.startSimulatedSession({
      companyId: input.companyId,
      userId: input.userId,
      routingBody: {
        sourceType: "ADMIN_SIMULATION",
        requiredCapabilities: ["SEARCH_CONTACT"],
        preferredSpecialization: "SUPPORT",
        ...(input.routingBody || {})
      }
    });

    const support = defaultAgentRegistry
      .list(input.companyId)
      .find(
        a =>
          a.id !== started.session.agentId &&
          a.status === "ACTIVE"
      );

    let delegation = null as Awaited<ReturnType<typeof simulateDelegation>> | null;
    if (support) {
      delegation = await simulateDelegation({
        companyId: input.companyId,
        userId: input.userId,
        approved: true,
        parentSession: started.session,
        persistKnowledge: true,
        request: {
          sourceAgentId: started.session.agentId,
          sourceSessionId: started.session.sessionId,
          rootSessionId: started.session.rootSessionId,
          requestedTargetAgentId: support.id,
          requiredSpecialization: support.specialization,
          requiredCapabilities: ["SEARCH_CONTACT"],
          goal: "Help customer",
          task: input.delegationTask || "Search contact details",
          expectedOutput: "contact summary",
          contextReferences: [],
          allowedContextScopes: ["EXECUTION_SCOPED"],
          forbiddenContextScopes: ["AGENT_PRIVATE"],
          priority: 100,
          deadline: null,
          maxDepth: 2,
          requiresConfirmation: true,
          metadata: {}
        }
      });
    }

    multiAgentStore(input.companyId).putSession({
      ...started.session,
      status: "COMPLETED_SIMULATION",
      updatedAt: new Date().toISOString()
    });
    emitMultiAgentEvent(
      input.companyId,
      "AGENT_SESSION_COMPLETED",
      started.session.sessionId
    );

    return {
      ...started,
      delegation,
      liveIntegrationEnabled: false,
      sharedKernel: true
    };
  }
}

export const defaultMultiAgentEngine = new MultiAgentEngine();

export async function GetMultiAgentDashboardService(input: {
  companyId: number;
}) {
  const store = multiAgentStore(input.companyId);
  const agents = store.listAgents();
  const health = store.listHealth();
  const base = getMultiAgentMetricsBase();
  return {
    agents: agents.length,
    active: agents.filter(a => a.status === "ACTIVE").length,
    healthy:
      health.filter(h => h.status === "HEALTHY").length ||
      agents.filter(a => a.status === "ACTIVE").length,
    degraded:
      health.filter(h => h.status === "DEGRADED").length ||
      agents.filter(a => a.status === "DEGRADED").length,
    routingRequests: base.routingRequests,
    routingSuccessRate: base.routingSuccessRate,
    delegations: base.delegationsCompleted,
    handoffs: base.handoffsCompleted,
    fallbacks: base.fallbacks,
    humanInterventions: base.humanInterventions,
    loopsBlocked: base.loopsDetected,
    resultConflicts: base.resultConflicts,
    metrics: base,
    liveIntegrationEnabled: false,
    coordinatorSimulationOnly: true,
    delegationSimulationOnly: true,
    handoffSimulationOnly: true,
    sharedKernel: true,
    duplicatesPlanner: false,
    duplicatesRuntime: false,
    continuousAutonomyEnabled: false
  };
}

export async function ReplayMultiAgentService(input: {
  companyId: number;
  id: string;
}) {
  const store = multiAgentStore(input.companyId);
  const selection =
    store.getSelection(input.id) ||
    store.listSelections().find(s => s.selectedAgentId === input.id) ||
    null;
  const session = store.getSession(input.id);
  const decision =
    selection ||
    (session?.routingDecisionId
      ? store.getSelection(session.routingDecisionId)
      : null);
  const context = decision
    ? store.getRoutingContext(decision.routingContextId)
    : null;
  const agentId = decision?.selectedAgentId || session?.agentId || input.id;
  const agent = defaultAgentRegistry.getById(input.companyId, agentId);
  const delegationResults = store
    .listDelegationResults()
    .filter(
      r =>
        r.sourceAgentId === agentId ||
        r.targetAgentId === agentId ||
        r.childSessionId === input.id
    );
  const childSessions = store
    .listDelegatedSessions()
    .filter(
      s =>
        s.parentSessionId === session?.sessionId ||
        s.id === input.id ||
        s.sourceAgentId === agentId
    );

  return {
    replay: {
      routingContext: context,
      selectionDecision: decision,
      rejectedCandidates: decision?.rejectedCandidates || [],
      agent,
      agentVersion: agent?.version ?? null,
      session,
      specializedContext: agent
        ? store.getSpecializedContext(
            `${input.companyId}:${agent.id}:${decision?.id || "none"}`
          )
        : null,
      childSessions,
      delegationResults,
      handoffs: store.listHandoffs(),
      handoffResults: store.listHandoffResults(),
      messages: store.listMessages(),
      coordination: store.listCoordination(),
      conflicts: store.listConflicts(),
      interventions: store.listInterventions(),
      health: agent ? store.getHealth(agent.id) : null,
      timeline: listMultiAgentEvents(input.companyId, 80),
      audits: listMultiAgentAudits(input.companyId, 40),
      liveIntegrationEnabled: false,
      sharedKernel: true
    }
  };
}

export {
  defaultAgentRegistry,
  routeAndSelect,
  buildRoutingContext,
  buildSpecializedAgentContext,
  simulateDelegation,
  simulateHandoff,
  createCoordinationPlan,
  simulateCoordination,
  validateAgentMessage,
  checkAgentHealth,
  evaluateFallbackSafety,
  createHumanIntervention,
  isolateAgentFailure,
  getMultiAgentConfig
};

export default defaultMultiAgentEngine;
