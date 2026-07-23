import { createHash } from "crypto";
import { getMultiAgentConfig } from "../MultiAgentConfig";
import { multiAgentStore } from "../stores/MultiAgentStore";
import { emitMultiAgentEvent } from "../MultiAgentEvents";
import { recordMultiAgentMetric, recordMultiAgentAudit } from "../metrics/MultiAgentMetrics";
import {
  AgentCapabilityProfile,
  AgentProfile,
  AgentProfileVersion
} from "../types";
import {
  AgentRole,
  AgentSpecialization,
  AgentStatus
} from "../../../../config/automationMultiAgentConstants";
import {
  defaultDelegationPolicy,
  defaultHandoffPolicy,
  defaultLearningPolicy,
  defaultMemoryPolicy,
  slugify
} from "../profiles/defaults";

function id(seed: string): string {
  return `ag_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

/**
 * AgentRegistry — cadastro tenant-scoped de agentes sobre o AgentOS compartilhado.
 */
export class AgentRegistry {
  register(input: {
    companyId: number;
    userId?: number | null;
    body: Partial<AgentProfile> & { name: string };
  }): { agent: AgentProfile; version: AgentProfileVersion } {
    const cfg = getMultiAgentConfig(input.companyId);
    if (!cfg.enabled) throw new Error("ERR_AGENT_PLAN_DISABLED");
    const store = multiAgentStore(input.companyId);
    const agents = store.listAgents();
    if (agents.length >= cfg.maxAgentsPerCompany) {
      throw new Error("ERR_AGENT_LIMIT_EXCEEDED");
    }
    const slug = slugify(String(input.body.slug || input.body.name));
    if (store.getAgentBySlug(slug)) throw new Error("ERR_AGENT_SLUG_DUPLICATE");

    const role = (input.body.role || "SPECIALIST") as AgentRole;
    if (
      role === "COORDINATOR" &&
      agents.filter(a => a.role === "COORDINATOR").length >= cfg.maxCoordinatorAgents
    ) {
      throw new Error("ERR_AGENT_LIMIT_EXCEEDED");
    }

    const now = new Date().toISOString();
    const agent: AgentProfile = {
      id: id(`${input.companyId}:${slug}:${now}`),
      companyId: input.companyId,
      name: input.body.name,
      slug,
      description: String(input.body.description || ""),
      role,
      specialization: (input.body.specialization || "GENERAL") as AgentSpecialization,
      status: (input.body.status as AgentStatus) || "DRAFT",
      enabled: input.body.enabled !== false,
      priority: Number(input.body.priority ?? 100),
      isDefault: input.body.isDefault === true,
      isCoordinator: role === "COORDINATOR" || input.body.isCoordinator === true,
      isHumanSupervised: input.body.isHumanSupervised === true,
      systemInstructions: String(input.body.systemInstructions || ""),
      businessInstructions: String(input.body.businessInstructions || ""),
      goalTypes: input.body.goalTypes || [],
      capabilities: input.body.capabilities || [],
      allowedStrategyTypes: input.body.allowedStrategyTypes || [],
      allowedRuntimeTypes: input.body.allowedRuntimeTypes || [
        "TOOL_RUNTIME",
        "MCP"
      ],
      allowedToolIds: input.body.allowedToolIds || [],
      blockedToolIds: input.body.blockedToolIds || [],
      allowedMcpServerIds: input.body.allowedMcpServerIds || [],
      allowedMcpTools: input.body.allowedMcpTools || [],
      blockedMcpTools: input.body.blockedMcpTools || [],
      memoryPolicy: input.body.memoryPolicy || defaultMemoryPolicy(),
      learningPolicy: input.body.learningPolicy || defaultLearningPolicy(),
      delegationPolicy: input.body.delegationPolicy || defaultDelegationPolicy(),
      handoffPolicy: input.body.handoffPolicy || defaultHandoffPolicy(),
      channelPolicy: input.body.channelPolicy || { channels: [], whatsappIds: [] },
      queueIds: input.body.queueIds || [],
      whatsappIds: input.body.whatsappIds || [],
      workingHours: input.body.workingHours ?? null,
      language: input.body.language || "pt-BR",
      provider: input.body.provider ?? null,
      model: input.body.model ?? null,
      temperature: input.body.temperature ?? null,
      maxTokens: input.body.maxTokens ?? null,
      executionLimits: input.body.executionLimits || {
        maxConcurrentSessions: cfg.maxConcurrentSessionsPerAgent,
        maxTokensPerSession: null
      },
      version: 1,
      createdBy: input.userId ?? null,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...(input.body.metadata || {}),
        sharedKernel: true,
        liveIntegrationEnabled: false
      }
    };

    if (agent.isDefault) {
      for (const a of agents.filter(x => x.isDefault)) {
        store.putAgent({ ...a, isDefault: false, updatedAt: now });
      }
    }

    store.putAgent(agent);
    const version = this.snapshotVersion(agent, input.userId, "create");
    const cap: AgentCapabilityProfile = {
      agentId: agent.id,
      capabilities: agent.capabilities,
      preferredCapabilities: agent.capabilities.slice(0, 3),
      blockedCapabilities: [],
      capabilityPriorities: Object.fromEntries(
        agent.capabilities.map((c, i) => [c, 100 - i])
      ),
      runtimePreferences: {},
      strategyPreferences: {},
      confidence: 1,
      source: "registry",
      version: 1,
      metadata: {}
    };
    store.putCapability(cap);
    recordMultiAgentMetric("agentsConfigured", 1, {
      role: agent.role,
      specialization: agent.specialization
    });
    emitMultiAgentEvent(input.companyId, "AGENT_CREATED", agent.id);
    emitMultiAgentEvent(input.companyId, "AGENT_VERSION_CREATED", version.id);
    recordMultiAgentAudit({
      companyId: input.companyId,
      userId: input.userId ?? null,
      agentId: agent.id,
      sourceAgentId: null,
      targetAgentId: null,
      agentVersion: 1,
      rootSessionId: null,
      sessionId: null,
      childSessionId: null,
      routingDecisionId: null,
      delegationRequestId: null,
      handoffRequestId: null,
      coordinationPlanId: null,
      action: "register",
      previousState: null,
      newState: agent.status,
      reasonCodes: ["created"],
      contextBoundarySummary: "",
      approvalMode: null,
      timestamp: now,
      metadataSanitized: { slug: agent.slug }
    });
    return { agent, version };
  }

  private snapshotVersion(
    agent: AgentProfile,
    userId: number | null | undefined,
    summary: string
  ): AgentProfileVersion {
    const store = multiAgentStore(agent.companyId);
    const version: AgentProfileVersion = {
      id: id(`${agent.id}:v:${agent.version}:${Date.now()}`),
      agentId: agent.id,
      companyId: agent.companyId,
      version: agent.version,
      snapshot: { ...agent },
      changeSummary: summary,
      changedBy: userId ?? null,
      createdAt: new Date().toISOString(),
      metadata: {}
    };
    store.putVersion(version);
    return version;
  }

  update(input: {
    companyId: number;
    id: string;
    userId?: number | null;
    body: Partial<AgentProfile>;
  }): { agent: AgentProfile; version: AgentProfileVersion } {
    const store = multiAgentStore(input.companyId);
    const current = store.getAgent(input.id);
    if (!current || current.companyId !== input.companyId) {
      throw new Error("ERR_AGENT_NOT_FOUND");
    }
    if (input.body.slug && input.body.slug !== current.slug) {
      const clash = store.getAgentBySlug(slugify(input.body.slug));
      if (clash && clash.id !== current.id) throw new Error("ERR_AGENT_SLUG_DUPLICATE");
    }
    const now = new Date().toISOString();
    const agent: AgentProfile = {
      ...current,
      ...input.body,
      id: current.id,
      companyId: current.companyId,
      slug: input.body.slug ? slugify(input.body.slug) : current.slug,
      version: current.version + 1,
      updatedAt: now,
      memoryPolicy: input.body.memoryPolicy || current.memoryPolicy,
      learningPolicy: input.body.learningPolicy || current.learningPolicy,
      delegationPolicy: input.body.delegationPolicy || current.delegationPolicy,
      handoffPolicy: input.body.handoffPolicy || current.handoffPolicy,
      metadata: {
        ...current.metadata,
        ...(input.body.metadata || {}),
        liveIntegrationEnabled: false
      }
    };
    store.putAgent(agent);
    const version = this.snapshotVersion(agent, input.userId, "update");
    store.putCapability({
      agentId: agent.id,
      capabilities: agent.capabilities,
      preferredCapabilities: agent.capabilities.slice(0, 3),
      blockedCapabilities: [],
      capabilityPriorities: Object.fromEntries(
        agent.capabilities.map((c, i) => [c, 100 - i])
      ),
      runtimePreferences: {},
      strategyPreferences: {},
      confidence: 1,
      source: "registry",
      version: agent.version,
      metadata: {}
    });
    emitMultiAgentEvent(input.companyId, "AGENT_UPDATED", agent.id);
    emitMultiAgentEvent(input.companyId, "AGENT_VERSION_CREATED", version.id);
    return { agent, version };
  }

  setStatus(input: {
    companyId: number;
    id: string;
    status: AgentStatus;
    userId?: number | null;
  }) {
    const store = multiAgentStore(input.companyId);
    const current = store.getAgent(input.id);
    if (!current || current.companyId !== input.companyId) {
      throw new Error("ERR_AGENT_NOT_FOUND");
    }
    const cfg = getMultiAgentConfig(input.companyId);
    if (input.status === "ACTIVE") {
      const active = store.listAgents().filter(a => a.status === "ACTIVE").length;
      if (current.status !== "ACTIVE" && active >= cfg.maxActiveAgentsPerCompany) {
        throw new Error("ERR_AGENT_LIMIT_EXCEEDED");
      }
    }
    const agent = {
      ...current,
      status: input.status,
      enabled: input.status === "ACTIVE" ? true : current.enabled && input.status !== "INACTIVE",
      updatedAt: new Date().toISOString()
    };
    store.putAgent(agent);
    if (input.status === "ACTIVE") {
      recordMultiAgentMetric("agentsActive", 1);
      emitMultiAgentEvent(input.companyId, "AGENT_ACTIVATED", agent.id);
    } else if (input.status === "SUSPENDED") {
      recordMultiAgentMetric("agentsSuspended", 1);
      emitMultiAgentEvent(input.companyId, "AGENT_SUSPENDED", agent.id);
    } else if (input.status === "INACTIVE") {
      emitMultiAgentEvent(input.companyId, "AGENT_DEACTIVATED", agent.id);
    } else if (input.status === "ARCHIVED") {
      emitMultiAgentEvent(input.companyId, "AGENT_ARCHIVED", agent.id);
    }
    return { agent };
  }

  getById(companyId: number, id: string) {
    const agent = multiAgentStore(companyId).getAgent(id);
    if (!agent || agent.companyId !== companyId) return null;
    return agent;
  }

  getBySlug(companyId: number, slug: string) {
    return multiAgentStore(companyId).getAgentBySlug(slug);
  }

  list(companyId: number) {
    return multiAgentStore(companyId).listAgents();
  }

  findCandidates(input: {
    companyId: number;
    capabilities?: string[];
    specialization?: AgentSpecialization | null;
    channel?: string | null;
    queueId?: number | null;
    whatsappId?: number | null;
    language?: string | null;
    onlySelectable?: boolean;
  }): AgentProfile[] {
    return this.list(input.companyId).filter(a => {
      if (input.onlySelectable !== false) {
        if (!(a.enabled && a.status === "ACTIVE")) return false;
      }
      if (input.specialization && a.specialization !== input.specialization && a.specialization !== "GENERAL") {
        // still allow GENERAL as soft match later via scoring
      }
      if (input.capabilities?.length) {
        const has = input.capabilities.every(c => a.capabilities.includes(c));
        if (!has && a.capabilities.length > 0) {
          // keep for rejected list scoring; filter soft below
        }
      }
      if (input.queueId != null && a.queueIds.length && !a.queueIds.includes(input.queueId)) {
        return false;
      }
      if (
        input.whatsappId != null &&
        a.whatsappIds.length &&
        !a.whatsappIds.includes(input.whatsappId)
      ) {
        return false;
      }
      if (
        input.channel &&
        a.channelPolicy.channels.length &&
        !a.channelPolicy.channels.includes(input.channel)
      ) {
        return false;
      }
      if (input.language && a.language && a.language !== input.language) {
        // soft — keep
      }
      return true;
    });
  }

  resolveDefault(companyId: number): AgentProfile | null {
    const agents = this.list(companyId).filter(
      a => a.enabled && a.status === "ACTIVE"
    );
    return (
      agents.find(a => a.isDefault) ||
      agents.sort((a, b) => a.priority - b.priority)[0] ||
      null
    );
  }

  duplicate(input: {
    companyId: number;
    id: string;
    userId?: number | null;
    name?: string;
  }) {
    const agent = this.getById(input.companyId, input.id);
    if (!agent) throw new Error("ERR_AGENT_NOT_FOUND");
    return this.register({
      companyId: input.companyId,
      userId: input.userId,
      body: {
        ...agent,
        name: input.name || `${agent.name} Copy`,
        slug: undefined as any,
        isDefault: false,
        status: "DRAFT"
      }
    });
  }
}

export const defaultAgentRegistry = new AgentRegistry();
export default defaultAgentRegistry;
