import { AgentMemoryPolicy, AgentProfile } from "../types";
import { MemoryScope } from "../../../../config/automationMultiAgentConstants";
import { recordMultiAgentMetric } from "../metrics/MultiAgentMetrics";
import { CognitiveMemoryEngine } from "../../cognitive/memory/CognitiveMemoryEngine";
import { MemoryQuery } from "../../cognitive/memory/memoryTypes";

/**
 * AgentMemoryAccessResolver — usa CognitiveMemoryEngine, nunca providers.
 */
export function canAccessMemory(input: {
  policy: AgentMemoryPolicy;
  scope: MemoryScope;
  memoryType: string;
  isOwnAgent: boolean;
  requestingAgentId: string;
  ownerAgentId: string | null;
}): { allowed: boolean; reasonCodes: string[] } {
  const reasons: string[] = [];
  if (!input.policy.allowedMemoryTypes.includes(input.memoryType)) {
    reasons.push("memory_type_blocked");
  }
  if (input.scope === "AGENT_PRIVATE") {
    if (!input.isOwnAgent || input.requestingAgentId !== input.ownerAgentId) {
      reasons.push("private_memory_forbidden");
    }
    if (!input.policy.readOwnMemory) reasons.push("read_own_disabled");
  }
  if (input.scope === "TENANT_SHARED" && !input.policy.readSharedTenantMemory) {
    reasons.push("tenant_shared_forbidden");
  }
  if (input.scope === "CONTACT_SCOPED" && !input.policy.readContactMemory) {
    reasons.push("contact_memory_forbidden");
  }
  if (input.scope === "TICKET_SCOPED" && !input.policy.readTicketMemory) {
    reasons.push("ticket_memory_forbidden");
  }
  if (reasons.length) {
    recordMultiAgentMetric("memoryAccessDenials");
    return { allowed: false, reasonCodes: reasons };
  }
  return { allowed: true, reasonCodes: [] };
}

export async function queryAgentMemory(input: {
  companyId: number;
  agent: AgentProfile;
  query: MemoryQuery;
  scope: MemoryScope;
  ownerAgentId?: string | null;
  memory?: CognitiveMemoryEngine;
}) {
  const access = canAccessMemory({
    policy: input.agent.memoryPolicy,
    scope: input.scope,
    memoryType: Array.isArray(input.query.memoryType)
      ? input.query.memoryType[0]
      : (input.query.memoryType as string) || "EPISODIC",
    isOwnAgent: (input.ownerAgentId || input.agent.id) === input.agent.id,
    requestingAgentId: input.agent.id,
    ownerAgentId: input.ownerAgentId ?? input.agent.id
  });
  if (!access.allowed) {
    throw new Error("ERR_AGENT_MEMORY_NOT_ALLOWED");
  }
  const engine = input.memory || new CognitiveMemoryEngine();
  const result = await engine.query({
    ...input.query,
    tenantId: input.companyId,
    // MemoryQuery.agentId is numeric (legacy); Multi-Agent uses string ids in tags/metadata.
    agentId: input.query.agentId ?? null,
    confidenceMin: Math.max(
      input.query.confidenceMin || 0,
      input.agent.memoryPolicy.minimumConfidence
    ),
    importanceMin: Math.max(
      input.query.importanceMin || 0,
      input.agent.memoryPolicy.minimumImportance
    )
  });
  return {
    ...result,
    results: result.results.filter(r => {
      const tags = r.object.tags || [];
      const agentTagOk =
        input.scope === "TENANT_SHARED" ||
        !tags.includes(`agent:${input.agent.id}`) ||
        tags.includes(`agent:${input.agent.id}`);
      return (
        agentTagOk &&
        !tags.some(t => input.agent.memoryPolicy.blockedTags.includes(t))
      );
    })
  };
}

export default { canAccessMemory, queryAgentMemory };
