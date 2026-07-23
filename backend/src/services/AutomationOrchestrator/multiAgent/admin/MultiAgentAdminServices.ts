import {
  AUTOMATION_MULTI_AGENT_FEATURE_KEY
} from "../../../../config/automationMultiAgentConstants";
import { assertAgentOsPlanFeature } from "../../security/AgentOsPlanGate";
import { getMultiAgentConfig, setMultiAgentConfig } from "../MultiAgentConfig";
import {
  defaultAgentRegistry,
  defaultMultiAgentEngine,
  GetMultiAgentDashboardService,
  ReplayMultiAgentService,
  routeAndSelect,
  simulateDelegation,
  simulateHandoff,
  createCoordinationPlan,
  simulateCoordination,
  validateAgentMessage,
  checkAgentHealth,
  evaluateFallbackSafety,
  createHumanIntervention,
  isolateAgentFailure,
  buildSpecializedAgentContext
} from "../MultiAgentEngine";
import { multiAgentStore } from "../stores/MultiAgentStore";
import { getMultiAgentMetricsBase, listMultiAgentAudits } from "../metrics/MultiAgentMetrics";
import { listMultiAgentEvents } from "../MultiAgentEvents";
import { resolveAgentToolBoundary } from "../policies/AgentToolBoundaryResolver";
import { canAccessMemory } from "../context/AgentMemoryAccessResolver";
import { detectDelegationLoop, evaluateDelegationPolicy } from "../delegation/AgentDelegationService";
import { evaluateHandoffPolicy } from "../handoff/AgentHandoffService";
import { AgentStatus } from "../../../../config/automationMultiAgentConstants";
import { AgentDelegationRequest, AgentProfile } from "../types";

async function assertPlan(companyId: number) {
  await assertAgentOsPlanFeature(companyId, AUTOMATION_MULTI_AGENT_FEATURE_KEY);
}

export async function CreateAgentService(input: {
  companyId: number;
  userId?: number | null;
  body: any;
}) {
  await assertPlan(input.companyId);
  return defaultAgentRegistry.register({
    companyId: input.companyId,
    userId: input.userId,
    body: input.body
  });
}

export async function ListAgentsService(input: { companyId: number }) {
  return { agents: defaultAgentRegistry.list(input.companyId) };
}

export async function GetAgentService(input: { companyId: number; id: string }) {
  const agent = defaultAgentRegistry.getById(input.companyId, input.id);
  if (!agent) throw new Error("ERR_AGENT_NOT_FOUND");
  return {
    agent,
    versions: multiAgentStore(input.companyId).listVersions(agent.id),
    capability: multiAgentStore(input.companyId).getCapability(agent.id),
    health: multiAgentStore(input.companyId).getHealth(agent.id),
    boundary: resolveAgentToolBoundary({ companyId: input.companyId, agent })
  };
}

export async function UpdateAgentService(input: {
  companyId: number;
  id: string;
  userId?: number | null;
  body: Partial<AgentProfile>;
}) {
  await assertPlan(input.companyId);
  return defaultAgentRegistry.update(input);
}

export async function DeleteAgentService(input: {
  companyId: number;
  id: string;
}) {
  await assertPlan(input.companyId);
  return defaultAgentRegistry.setStatus({
    companyId: input.companyId,
    id: input.id,
    status: "ARCHIVED"
  });
}

export async function AgentStatusService(input: {
  companyId: number;
  id: string;
  status: AgentStatus;
  userId?: number | null;
}) {
  await assertPlan(input.companyId);
  return defaultAgentRegistry.setStatus(input);
}

export async function DuplicateAgentService(input: {
  companyId: number;
  id: string;
  userId?: number | null;
  name?: string;
}) {
  await assertPlan(input.companyId);
  return defaultAgentRegistry.duplicate(input);
}

export async function ListAgentVersionsService(input: {
  companyId: number;
  id: string;
}) {
  return { versions: multiAgentStore(input.companyId).listVersions(input.id) };
}

export async function GetAgentVersionService(input: {
  companyId: number;
  id: string;
  version: string;
}) {
  const versions = multiAgentStore(input.companyId).listVersions(input.id);
  const found =
    versions.find(v => String(v.version) === String(input.version)) ||
    multiAgentStore(input.companyId).getVersion(input.version);
  if (!found) throw new Error("ERR_AGENT_NOT_FOUND");
  return { version: found };
}

export async function HealthAgentService(input: {
  companyId: number;
  id: string;
  body?: Record<string, unknown>;
}) {
  return {
    health: checkAgentHealth({
      companyId: input.companyId,
      agentId: input.id,
      activeSessions: Number(input.body?.activeSessions || 0),
      recentFailures: Number(input.body?.recentFailures || 0),
      recentTotal: Number(input.body?.recentTotal || 0)
    })
  };
}

export async function SimulateRoutingService(input: {
  companyId: number;
  userId?: number | null;
  body: Record<string, unknown>;
}) {
  return routeAndSelect({
    companyId: input.companyId,
    userId: input.userId,
    body: { ...input.body, sourceType: input.body.sourceType || "ADMIN_SIMULATION" }
  });
}

export async function SelectRoutingService(input: {
  companyId: number;
  userId?: number | null;
  body: Record<string, unknown>;
}) {
  await assertPlan(input.companyId);
  const routed = routeAndSelect({
    companyId: input.companyId,
    userId: input.userId,
    body: input.body
  });
  if (!routed.decision.selectedAgentId) return routed;
  const agent = defaultAgentRegistry.getById(
    input.companyId,
    routed.decision.selectedAgentId
  )!;
  const specialized = buildSpecializedAgentContext({
    companyId: input.companyId,
    agent,
    routingDecisionId: routed.decision.id
  });
  return { ...routed, specialized };
}

export async function ListRoutingDecisionsService(input: { companyId: number }) {
  return { decisions: multiAgentStore(input.companyId).listSelections() };
}

export async function GetRoutingDecisionService(input: {
  companyId: number;
  id: string;
}) {
  const decision = multiAgentStore(input.companyId).getSelection(input.id);
  if (!decision) throw new Error("ERR_AGENT_SELECTION_FAILED");
  return { decision };
}

export async function UpsertStickyService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  const store = multiAgentStore(input.companyId);
  const cfg = getMultiAgentConfig(input.companyId);
  const sticky = {
    id: `stk_${Date.now()}`,
    companyId: input.companyId,
    scopeType: (input.body.scopeType as any) || "contactId",
    scopeId: String(input.body.scopeId || ""),
    agentId: String(input.body.agentId || ""),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + cfg.stickyAssignmentTtlMs).toISOString(),
    lastUsedAt: new Date().toISOString(),
    reason: String(input.body.reason || "manual"),
    metadata: {}
  };
  store.putSticky(sticky);
  return { sticky };
}

export async function ListStickyService(input: { companyId: number }) {
  return { sticky: multiAgentStore(input.companyId).listSticky() };
}

export async function DeleteStickyService(input: {
  companyId: number;
  id: string;
}) {
  multiAgentStore(input.companyId).deleteSticky(input.id);
  return { deleted: true };
}

export async function PreviewDelegationService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  const request = {
    id: "preview",
    companyId: input.companyId,
    sourceAgentId: String(input.body.sourceAgentId || ""),
    sourceSessionId: String(input.body.sourceSessionId || "sess"),
    rootSessionId: String(input.body.rootSessionId || "root"),
    requestedTargetAgentId: (input.body.requestedTargetAgentId as string) || null,
    requiredSpecialization: (input.body.requiredSpecialization as any) || null,
    requiredCapabilities: (input.body.requiredCapabilities as string[]) || [],
    goal: String(input.body.goal || ""),
    task: String(input.body.task || ""),
    expectedOutput: "",
    contextReferences: [],
    allowedContextScopes: ["EXECUTION_SCOPED"] as any,
    forbiddenContextScopes: ["AGENT_PRIVATE"] as any,
    priority: 100,
    deadline: null,
    maxDepth: Number(input.body.maxDepth || 2),
    requiresConfirmation: true,
    createdAt: new Date().toISOString(),
    metadata: {}
  } as AgentDelegationRequest;
  return {
    decision: evaluateDelegationPolicy({
      companyId: input.companyId,
      request,
      approved: false
    }),
    loop: detectDelegationLoop({
      sourceAgentId: request.sourceAgentId,
      targetAgentId: request.requestedTargetAgentId || "x",
      chain: [request.sourceAgentId],
      task: request.task,
      previousTasks: []
    })
  };
}

export async function SimulateDelegationService(input: {
  companyId: number;
  userId?: number | null;
  body: Record<string, unknown>;
  approved?: boolean;
}) {
  await assertPlan(input.companyId);
  return simulateDelegation({
    companyId: input.companyId,
    userId: input.userId,
    approved: input.approved ?? input.body.approved === true,
    persistKnowledge: input.body.persistKnowledge === true,
    request: {
      sourceAgentId: String(input.body.sourceAgentId || ""),
      sourceSessionId: String(input.body.sourceSessionId || "sess"),
      rootSessionId: String(input.body.rootSessionId || "root"),
      requestedTargetAgentId: (input.body.requestedTargetAgentId as string) || null,
      requiredSpecialization: (input.body.requiredSpecialization as any) || null,
      requiredCapabilities: (input.body.requiredCapabilities as string[]) || [],
      goal: String(input.body.goal || ""),
      task: String(input.body.task || ""),
      expectedOutput: String(input.body.expectedOutput || ""),
      contextReferences: [],
      allowedContextScopes: ["EXECUTION_SCOPED"],
      forbiddenContextScopes: ["AGENT_PRIVATE"],
      priority: 100,
      deadline: null,
      maxDepth: Number(input.body.maxDepth || 2),
      requiresConfirmation: true,
      metadata: {}
    }
  });
}

export async function ListDelegationsService(input: { companyId: number }) {
  const store = multiAgentStore(input.companyId);
  return {
    delegations: store.listDelegations(),
    results: store.listDelegationResults(),
    childSessions: store.listDelegatedSessions()
  };
}

export async function GetDelegationService(input: {
  companyId: number;
  id: string;
}) {
  const store = multiAgentStore(input.companyId);
  const delegation = store.getDelegation(input.id);
  if (!delegation) throw new Error("ERR_AGENT_DELEGATION_BLOCKED");
  return {
    delegation,
    childSession: store
      .listDelegatedSessions()
      .find(s => s.delegationRequestId === input.id),
    result: store
      .listDelegationResults()
      .find(r => r.delegationRequestId === input.id)
  };
}

export async function SimulateHandoffService(input: {
  companyId: number;
  userId?: number | null;
  body: Record<string, unknown>;
  approved?: boolean;
}) {
  await assertPlan(input.companyId);
  return simulateHandoff({
    companyId: input.companyId,
    userId: input.userId,
    approved: input.approved ?? input.body.approved === true,
    body: {
      sourceAgentId: String(input.body.sourceAgentId || ""),
      sourceSessionId: String(input.body.sourceSessionId || "sess"),
      requestedTargetAgentId: (input.body.requestedTargetAgentId as string) || null,
      reason: String(input.body.reason || "handoff"),
      reasonCode: String(input.body.reasonCode || "SPECIALIST_NEEDED"),
      goal: String(input.body.goal || ""),
      handoffType: (input.body.handoffType as any) || "CONTEXTUAL_HANDOFF",
      contextSharingLevel: (input.body.contextSharingLevel as any) || "TASK_ONLY",
      preserveStickyAssignment: true,
      requiresHumanApproval: true,
      metadata: {}
    }
  });
}

export async function PreviewHandoffService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  return {
    decision: evaluateHandoffPolicy({
      companyId: input.companyId,
      request: {
        id: "preview",
        companyId: input.companyId,
        sourceAgentId: String(input.body.sourceAgentId || ""),
        sourceSessionId: String(input.body.sourceSessionId || "sess"),
        requestedTargetAgentId: (input.body.requestedTargetAgentId as string) || null,
        reason: String(input.body.reason || ""),
        reasonCode: "PREVIEW",
        goal: String(input.body.goal || ""),
        handoffType: (input.body.handoffType as any) || "CONTEXTUAL_HANDOFF",
        contextSharingLevel: "TASK_ONLY",
        preserveStickyAssignment: true,
        requiresHumanApproval: true,
        createdAt: new Date().toISOString(),
        metadata: {}
      },
      approved: false
    })
  };
}

export async function ListHandoffsService(input: { companyId: number }) {
  const store = multiAgentStore(input.companyId);
  return {
    handoffs: store.listHandoffs(),
    results: store.listHandoffResults()
  };
}

export async function GetHandoffService(input: {
  companyId: number;
  id: string;
}) {
  const handoff = multiAgentStore(input.companyId).getHandoff(input.id);
  if (!handoff) throw new Error("ERR_AGENT_HANDOFF_BLOCKED");
  return { handoff };
}

export async function CreateCoordinationService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  await assertPlan(input.companyId);
  return {
    plan: createCoordinationPlan({
      companyId: input.companyId,
      coordinatorAgentId: String(input.body.coordinatorAgentId || ""),
      rootGoalId: String(input.body.rootGoalId || "goal"),
      tasks: (input.body.tasks as any[]) || [
        { title: "Task A", requiredCapabilities: ["SEARCH_CONTACT"] },
        { title: "Task B", requiredCapabilities: ["SEARCH_KNOWLEDGE"], dependencies: [] }
      ]
    })
  };
}

export async function SimulateCoordinationService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  const planId = String(input.body.planId || "");
  if (!planId) {
    const created = await CreateCoordinationService(input);
    return simulateCoordination({
      companyId: input.companyId,
      planId: created.plan.id
    });
  }
  return simulateCoordination({ companyId: input.companyId, planId });
}

export async function ListCoordinationService(input: { companyId: number }) {
  return { plans: multiAgentStore(input.companyId).listCoordination() };
}

export async function GetCoordinationService(input: {
  companyId: number;
  id: string;
}) {
  const plan = multiAgentStore(input.companyId).getCoordination(input.id);
  if (!plan) throw new Error("ERR_AGENT_COORDINATION_DISABLED");
  return { plan };
}

export async function SendAgentMessageService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  return validateAgentMessage({
    companyId: input.companyId,
    message: {
      sourceAgentId: String(input.body.sourceAgentId || ""),
      targetAgentId: String(input.body.targetAgentId || ""),
      messageType: (input.body.messageType as any) || "TASK_REQUEST",
      payload: (input.body.payload as any) || {},
      sourceSessionId: (input.body.sourceSessionId as string) || null,
      targetSessionId: (input.body.targetSessionId as string) || null,
      requiresResponse: input.body.requiresResponse === true,
      expiresAt: input.body.expiresAt as string | undefined,
      metadata: {}
    }
  });
}

export async function ListMessagesService(input: { companyId: number }) {
  return { messages: multiAgentStore(input.companyId).listMessages() };
}

export async function GetMessageService(input: {
  companyId: number;
  id: string;
}) {
  const message = multiAgentStore(input.companyId).getMessage(input.id);
  if (!message) throw new Error("ERR_AGENT_MESSAGE_INVALID");
  return { message };
}

export async function CreateInterventionService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  return {
    intervention: createHumanIntervention({
      companyId: input.companyId,
      sessionId: String(input.body.sessionId || ""),
      agentId: String(input.body.agentId || ""),
      reason: String(input.body.reason || "review"),
      severity: String(input.body.severity || "MEDIUM"),
      requestedAction: String(input.body.requestedAction || "REVIEW"),
      contextSummary: String(input.body.contextSummary || "")
    })
  };
}

export async function ListInterventionsService(input: { companyId: number }) {
  return { interventions: multiAgentStore(input.companyId).listInterventions() };
}

export async function GetInterventionService(input: {
  companyId: number;
  id: string;
}) {
  const intervention = multiAgentStore(input.companyId).getIntervention(input.id);
  if (!intervention) throw new Error("ERR_AGENT_HUMAN_INTERVENTION_REQUIRED");
  return { intervention };
}

export async function ResolveInterventionService(input: {
  companyId: number;
  id: string;
  body: Record<string, unknown>;
}) {
  const store = multiAgentStore(input.companyId);
  const current = store.getIntervention(input.id);
  if (!current) throw new Error("ERR_AGENT_HUMAN_INTERVENTION_REQUIRED");
  const intervention = {
    ...current,
    status: "RESOLVED" as const,
    resolvedAt: new Date().toISOString(),
    resolution: String(input.body.resolution || "resolved"),
    assignedUserId:
      input.body.assignedUserId != null
        ? Number(input.body.assignedUserId)
        : current.assignedUserId
  };
  store.putIntervention(intervention);
  return { intervention };
}

export async function ListSessionsService(input: { companyId: number }) {
  return {
    sessions: multiAgentStore(input.companyId).listSessions(),
    childSessions: multiAgentStore(input.companyId).listDelegatedSessions()
  };
}

export async function GetSessionService(input: {
  companyId: number;
  id: string;
}) {
  const session = multiAgentStore(input.companyId).getSession(input.id);
  if (!session) throw new Error("ERR_AGENT_NOT_FOUND");
  return { session };
}

export async function GetMetricsService(input: { companyId: number }) {
  return {
    metrics: getMultiAgentMetricsBase(),
    events: listMultiAgentEvents(input.companyId, 40),
    audits: listMultiAgentAudits(input.companyId, 40)
  };
}

export async function GetDashboardService(input: { companyId: number }) {
  return GetMultiAgentDashboardService(input);
}

export async function GetReplayService(input: {
  companyId: number;
  id: string;
}) {
  return ReplayMultiAgentService(input);
}

export async function GetAuditService(input: { companyId: number }) {
  return { audits: listMultiAgentAudits(input.companyId, 100) };
}

export async function GetConfigService(input: { companyId: number }) {
  return { config: getMultiAgentConfig(input.companyId) };
}

export async function PutConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  await assertPlan(input.companyId);
  return {
    config: setMultiAgentConfig(input.companyId, {
      ...input.config,
      liveIntegrationEnabled: false,
      coordinatorSimulationOnly: true,
      delegationSimulationOnly: true,
      handoffSimulationOnly: true,
      continuousAutonomyEnabled: false,
      usesGenerativeAiForSelection: false
    })
  };
}

export async function SimulateFullFlowService(input: {
  companyId: number;
  userId?: number | null;
  body?: Record<string, unknown>;
}) {
  await assertPlan(input.companyId);
  return defaultMultiAgentEngine.runFullSimulationFlow({
    companyId: input.companyId,
    userId: input.userId,
    routingBody: input.body || {},
    delegationTask: String(input.body?.delegationTask || "Search contact")
  });
}

export async function SimulateMemoryPolicyService(input: {
  companyId: number;
  agentId: string;
  scope: string;
  memoryType?: string;
}) {
  const agent = defaultAgentRegistry.getById(input.companyId, input.agentId);
  if (!agent) throw new Error("ERR_AGENT_NOT_FOUND");
  return canAccessMemory({
    policy: agent.memoryPolicy,
    scope: input.scope as any,
    memoryType: input.memoryType || "EPISODIC",
    isOwnAgent: true,
    requestingAgentId: agent.id,
    ownerAgentId: agent.id
  });
}

export async function SimulateFallbackService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  return {
    fallback: evaluateFallbackSafety({
      companyId: input.companyId,
      preferredAgentId: (input.body.preferredAgentId as string) || null,
      capability: input.body.capability as string | undefined,
      writeAmbiguous: input.body.writeAmbiguous === true
    })
  };
}

export async function IsolateFailureService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  return isolateAgentFailure({
    companyId: input.companyId,
    agentId: String(input.body.agentId || ""),
    sessionId: input.body.sessionId as string | undefined,
    reason: String(input.body.reason || "failure")
  });
}

export default {
  CreateAgentService,
  GetDashboardService,
  SimulateFullFlowService
};
