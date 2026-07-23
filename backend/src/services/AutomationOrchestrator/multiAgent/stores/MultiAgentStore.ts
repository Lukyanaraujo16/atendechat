import {
  AgentCapabilityProfile,
  AgentContextBoundary,
  AgentCoordinationPlan,
  AgentDelegationRequest,
  AgentDelegationResult,
  AgentHealthRecord,
  AgentHandoffRequest,
  AgentHandoffResult,
  AgentHumanInterventionRequest,
  AgentMessage,
  AgentProfile,
  AgentProfileVersion,
  AgentResultConflict,
  AgentRoutingContext,
  AgentSelectionDecision,
  AgentStickyAssignment,
  DelegatedExecutionSession,
  MultiAgentSessionContext,
  SpecializedAgentContext
} from "../types";
import { multiAgentRepository } from "../../persistence/repositories/MultiAgentRepository";
import { documentRepository } from "../../persistence/repositories/DocumentRepository";
import { observabilityRepository } from "../../persistence/repositories/ObservabilityRepository";

function persistDoc(
  companyId: number,
  entityType: string,
  entityKey: string,
  payload: Record<string, unknown>,
  extras?: { agentId?: string; sessionId?: string; status?: string }
) {
  documentRepository.upsertFireAndForget({
    companyId,
    entityType,
    entityKey,
    payload,
    agentId: extras?.agentId ?? null,
    sessionId: extras?.sessionId ?? null,
    status: extras?.status ?? null
  });
}

type Tables = {
  agents: Map<string, AgentProfile>;
  versions: Map<string, AgentProfileVersion>;
  capabilities: Map<string, AgentCapabilityProfile>;
  sticky: Map<string, AgentStickyAssignment>;
  routingContexts: Map<string, AgentRoutingContext>;
  selections: Map<string, AgentSelectionDecision>;
  specializedContexts: Map<string, SpecializedAgentContext>;
  sessions: Map<string, MultiAgentSessionContext>;
  boundaries: Map<string, AgentContextBoundary>;
  delegations: Map<string, AgentDelegationRequest>;
  delegatedSessions: Map<string, DelegatedExecutionSession>;
  delegationResults: Map<string, AgentDelegationResult>;
  handoffs: Map<string, AgentHandoffRequest>;
  handoffResults: Map<string, AgentHandoffResult>;
  coordination: Map<string, AgentCoordinationPlan>;
  messages: Map<string, AgentMessage>;
  conflicts: Map<string, AgentResultConflict>;
  interventions: Map<string, AgentHumanInterventionRequest>;
  health: Map<string, AgentHealthRecord>;
  idempotency: Map<string, string>;
};

const byCompany = new Map<number, Tables>();

function tables(companyId: number): Tables {
  if (!byCompany.has(companyId)) {
    byCompany.set(companyId, {
      agents: new Map(),
      versions: new Map(),
      capabilities: new Map(),
      sticky: new Map(),
      routingContexts: new Map(),
      selections: new Map(),
      specializedContexts: new Map(),
      sessions: new Map(),
      boundaries: new Map(),
      delegations: new Map(),
      delegatedSessions: new Map(),
      delegationResults: new Map(),
      handoffs: new Map(),
      handoffResults: new Map(),
      coordination: new Map(),
      messages: new Map(),
      conflicts: new Map(),
      interventions: new Map(),
      health: new Map(),
      idempotency: new Map()
    });
  }
  return byCompany.get(companyId)!;
}

export function multiAgentStore(companyId: number) {
  const t = tables(companyId);
  return {
    putAgent: (a: AgentProfile) => {
      t.agents.set(a.id, a);
      multiAgentRepository.upsertAgentFireAndForget(companyId, a as any);
    },
    getAgent: (id: string) => t.agents.get(id) || null,
    getAgentBySlug: (slug: string) =>
      Array.from(t.agents.values()).find(a => a.slug === slug) || null,
    listAgents: () => Array.from(t.agents.values()),
    deleteAgent: (id: string) => {
      const ok = t.agents.delete(id);
      if (ok) void multiAgentRepository.softDeleteAgent(companyId, id);
      return ok;
    },
    putVersion: (v: AgentProfileVersion) => {
      t.versions.set(v.id, v);
      multiAgentRepository.insertVersionFireAndForget(companyId, v as any);
    },
    listVersions: (agentId: string) =>
      Array.from(t.versions.values()).filter(v => v.agentId === agentId),
    getVersion: (id: string) => t.versions.get(id) || null,
    putCapability: (c: AgentCapabilityProfile) => {
      t.capabilities.set(c.agentId, c);
      persistDoc(companyId, "multiAgent.capability", c.agentId, c as any, { agentId: c.agentId });
    },
    getCapability: (agentId: string) => t.capabilities.get(agentId) || null,
    putSticky: (s: AgentStickyAssignment) => {
      t.sticky.set(s.id, s);
      persistDoc(companyId, "multiAgent.sticky", s.id, s as any, { agentId: s.agentId });
    },
    getSticky: (id: string) => t.sticky.get(id) || null,
    listSticky: () => Array.from(t.sticky.values()),
    deleteSticky: (id: string) => t.sticky.delete(id),
    putRoutingContext: (c: AgentRoutingContext) =>
      t.routingContexts.set(c.id, c),
    getRoutingContext: (id: string) => t.routingContexts.get(id) || null,
    putSelection: (d: AgentSelectionDecision) => {
      t.selections.set(d.id, d);
      persistDoc(companyId, "multiAgent.selection", d.id, d as any, { agentId: d.selectedAgentId || undefined });
    },
    getSelection: (id: string) => t.selections.get(id) || null,
    listSelections: () => Array.from(t.selections.values()),
    putSpecializedContext: (key: string, c: SpecializedAgentContext) =>
      t.specializedContexts.set(key, c),
    getSpecializedContext: (key: string) =>
      t.specializedContexts.get(key) || null,
    putSession: (s: MultiAgentSessionContext) => {
      t.sessions.set(s.sessionId, s);
      multiAgentRepository.upsertSessionFireAndForget(companyId, s as any);
    },
    getSession: (id: string) => t.sessions.get(id) || null,
    listSessions: () => Array.from(t.sessions.values()),
    putBoundary: (b: AgentContextBoundary) => t.boundaries.set(b.id, b),
    getBoundary: (id: string) => t.boundaries.get(id) || null,
    putDelegation: (d: AgentDelegationRequest) => {
      t.delegations.set(d.id, d);
      persistDoc(companyId, "multiAgent.delegation", d.id, d as any, { agentId: d.sourceAgentId, sessionId: d.sourceSessionId });
    },
    getDelegation: (id: string) => t.delegations.get(id) || null,
    listDelegations: () => Array.from(t.delegations.values()),
    putDelegatedSession: (s: DelegatedExecutionSession) =>
      t.delegatedSessions.set(s.id, s),
    getDelegatedSession: (id: string) => t.delegatedSessions.get(id) || null,
    putDelegationResult: (r: AgentDelegationResult) =>
      t.delegationResults.set(r.id, r),
    getDelegationResult: (id: string) => t.delegationResults.get(id) || null,
    listDelegationResults: () => Array.from(t.delegationResults.values()),
    listDelegatedSessions: () => Array.from(t.delegatedSessions.values()),
    listHandoffResults: () => Array.from(t.handoffResults.values()),
    putHandoff: (h: AgentHandoffRequest) => {
      t.handoffs.set(h.id, h);
      persistDoc(companyId, "multiAgent.handoff", h.id, h as any, { agentId: h.sourceAgentId, sessionId: h.sourceSessionId });
    },
    getHandoff: (id: string) => t.handoffs.get(id) || null,
    listHandoffs: () => Array.from(t.handoffs.values()),
    putHandoffResult: (r: AgentHandoffResult) => t.handoffResults.set(r.id, r),
    putCoordination: (p: AgentCoordinationPlan) =>
      t.coordination.set(p.id, p),
    getCoordination: (id: string) => t.coordination.get(id) || null,
    listCoordination: () => Array.from(t.coordination.values()),
    putMessage: (m: AgentMessage) => t.messages.set(m.id, m),
    getMessage: (id: string) => t.messages.get(id) || null,
    listMessages: () => Array.from(t.messages.values()),
    putConflict: (c: AgentResultConflict) => t.conflicts.set(c.id, c),
    listConflicts: () => Array.from(t.conflicts.values()),
    putIntervention: (i: AgentHumanInterventionRequest) =>
      t.interventions.set(i.id, i),
    getIntervention: (id: string) => t.interventions.get(id) || null,
    listInterventions: () => Array.from(t.interventions.values()),
    putHealth: (h: AgentHealthRecord) => t.health.set(h.agentId, h),
    getHealth: (agentId: string) => t.health.get(agentId) || null,
    listHealth: () => Array.from(t.health.values()),
    claimIdempotency: (key: string, value: string) => {
      if (t.idempotency.has(key)) return t.idempotency.get(key)!;
      t.idempotency.set(key, value);
      void observabilityRepository.claimIdempotency(companyId, key, "multiAgent", value);
      return null;
    },
    getIdempotency: (key: string) => t.idempotency.get(key) || null
  };
}

export function __resetMultiAgentStoreForTests(): void {
  byCompany.clear();
}

/** Wave 5 DB-first hydrate — não re-persiste. */
export function __hydrateMultiAgentAgent(
  companyId: number,
  profile: AgentProfile
): void {
  const t = tables(companyId);
  if (profile?.id) t.agents.set(String(profile.id), profile);
}

export function __hydrateMultiAgentSession(
  companyId: number,
  session: MultiAgentSessionContext
): void {
  const t = tables(companyId);
  const id = (session as any).sessionId || (session as any).id;
  if (id) t.sessions.set(String(id), session);
}

export default { multiAgentStore };
