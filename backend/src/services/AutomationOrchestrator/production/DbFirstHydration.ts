import { multiAgentRepository } from "../persistence/repositories/MultiAgentRepository";
import { documentRepository } from "../persistence/repositories/DocumentRepository";
import { mcpRepository } from "../persistence/repositories/McpRepository";
import { __hydrateMultiAgentAgent, __hydrateMultiAgentSession } from "../multiAgent/stores/MultiAgentStore";
import { __hydrateMcpServer } from "../mcp/McpServerStore";
import { __hydrateLearningEntity } from "../learning/stores/LearningStore";
import { getAgentOsPersistenceBackend } from "../persistence/persistenceUtils";
import { agentOsLog } from "../observability/StructuredLogger";

const hydrated = new Set<string>();

export async function hydrateMultiAgentCompany(companyId: number) {
  const key = `ma:${companyId}`;
  if (hydrated.has(key) || getAgentOsPersistenceBackend() !== "sequelize") {
    return { agents: 0, sessions: 0 };
  }
  const agents = await multiAgentRepository.listAgents(companyId);
  for (const a of agents as any[]) {
    __hydrateMultiAgentAgent(companyId, a);
  }
  const sessions = await multiAgentRepository.listSessions(companyId);
  for (const s of sessions as any[]) {
    __hydrateMultiAgentSession(companyId, s);
  }
  hydrated.add(key);
  agentOsLog("info", {
    type: "hydrate.multi_agent",
    companyId,
    agents: agents.length,
    sessions: sessions.length
  });
  return { agents: agents.length, sessions: sessions.length };
}

export async function hydrateMcpCompany(companyId: number) {
  const key = `mcp:${companyId}`;
  if (hydrated.has(key) || getAgentOsPersistenceBackend() !== "sequelize") {
    return { servers: 0 };
  }
  const servers = await mcpRepository.listServers(companyId);
  for (const s of servers as any[]) {
    __hydrateMcpServer(companyId, s);
  }
  hydrated.add(key);
  agentOsLog("info", { type: "hydrate.mcp", companyId, servers: servers.length });
  return { servers: servers.length };
}

export async function hydrateLearningCompany(companyId: number) {
  const key = `learn:${companyId}`;
  if (hydrated.has(key) || getAgentOsPersistenceBackend() !== "sequelize") {
    return { documents: 0 };
  }
  const types = [
    "learning.candidate",
    "learning.artifact",
    "learning.analysis",
    "learning.dataset",
    "learning.pattern"
  ];
  let n = 0;
  for (const entityType of types) {
    const docs = await documentRepository.list(companyId, entityType, 200);
    for (const d of docs) {
      __hydrateLearningEntity(companyId, entityType, d.payload || {});
      n += 1;
    }
  }
  hydrated.add(key);
  agentOsLog("info", { type: "hydrate.learning", companyId, documents: n });
  return { documents: n };
}

export async function hydrateAgentOsTenant(companyId: number) {
  const [multiAgent, mcp, learning] = await Promise.all([
    hydrateMultiAgentCompany(companyId),
    hydrateMcpCompany(companyId),
    hydrateLearningCompany(companyId)
  ]);
  return { multiAgent, mcp, learning };
}

export function resetHydrationFlags(): void {
  hydrated.clear();
}
