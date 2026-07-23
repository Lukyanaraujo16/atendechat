import { Transaction } from "sequelize";
import AutomationMultiAgent from "../../../../models/AutomationMultiAgent";
import AutomationMultiAgentVersion from "../../../../models/AutomationMultiAgentVersion";
import AutomationMultiAgentSession from "../../../../models/AutomationMultiAgentSession";
import {
  assertCompanyId,
  getAgentOsPersistenceBackend,
  persistAsync
} from "../persistenceUtils";

export class MultiAgentRepository {
  async upsertAgent(
    companyId: number,
    agent: Record<string, unknown>,
    transaction?: Transaction
  ) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return agent;
    const id = String(agent.id);
    await AutomationMultiAgent.upsert(
      {
        id,
        companyId,
        slug: String(agent.slug),
        name: String(agent.name),
        status: String(agent.status || "DRAFT"),
        role: String(agent.role || "SPECIALIST"),
        specialization: String(agent.specialization || "GENERAL"),
        enabled: agent.enabled !== false,
        version: Number(agent.version || 1),
        isDefault: agent.isDefault === true,
        isCoordinator: agent.isCoordinator === true,
        payload: agent
      } as any,
      { transaction }
    );
    return agent;
  }

  upsertAgentFireAndForget(companyId: number, agent: Record<string, unknown>) {
    persistAsync(() => this.upsertAgent(companyId, agent), "multiAgent.agent");
  }

  async insertVersion(
    companyId: number,
    version: Record<string, unknown>,
    transaction?: Transaction
  ) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return version;
    await AutomationMultiAgentVersion.create(
      {
        id: String(version.id),
        companyId,
        agentId: String(version.agentId),
        version: Number(version.version),
        snapshot: version.snapshot || version,
        changeSummary: (version.changeSummary as string) || null,
        changedBy: (version.changedBy as number) ?? null,
        metadata: (version.metadata as Record<string, unknown>) || null
      } as any,
      { transaction }
    );
    return version;
  }

  insertVersionFireAndForget(
    companyId: number,
    version: Record<string, unknown>
  ) {
    persistAsync(
      () => this.insertVersion(companyId, version),
      "multiAgent.version"
    );
  }

  async upsertSession(
    companyId: number,
    session: Record<string, unknown>,
    transaction?: Transaction
  ) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return session;
    const id = String(session.sessionId || session.id);
    await AutomationMultiAgentSession.upsert(
      {
        id,
        companyId,
        rootSessionId: String(session.rootSessionId || id),
        parentSessionId: (session.parentSessionId as string) || null,
        agentId: String(session.agentId),
        agentVersion: (session.agentVersion as number) ?? null,
        supervisorAgentId: (session.supervisorAgentId as string) || null,
        delegatedByAgentId: (session.delegatedByAgentId as string) || null,
        delegationDepth: Number(session.delegationDepth || 0),
        handoffCount: Number(session.handoffCount || 0),
        routingDecisionId: (session.routingDecisionId as string) || null,
        contextBoundaryId: (session.contextBoundaryId as string) || null,
        status: String(session.status || "CREATED"),
        payload: session
      } as any,
      { transaction }
    );
    return session;
  }

  upsertSessionFireAndForget(
    companyId: number,
    session: Record<string, unknown>
  ) {
    persistAsync(
      () => this.upsertSession(companyId, session),
      "multiAgent.session"
    );
  }

  async listAgents(companyId: number) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return [];
    const rows = await AutomationMultiAgent.findAll({ where: { companyId } });
    return rows.map(r => ({ ...(r.payload || {}), id: r.id, companyId: r.companyId }));
  }

  async listSessions(companyId: number) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return [];
    const rows = await AutomationMultiAgentSession.findAll({
      where: { companyId },
      order: [["updatedAt", "DESC"]],
      limit: 500
    });
    return rows.map(r => ({ ...(r.payload || {}), sessionId: r.id, companyId }));
  }

  async softDeleteAgent(companyId: number, id: string) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return false;
    const n = await AutomationMultiAgent.destroy({ where: { companyId, id } });
    return n > 0;
  }
}

export const multiAgentRepository = new MultiAgentRepository();
export default multiAgentRepository;
