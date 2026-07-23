import { Transaction } from "sequelize";
import AutomationAgentOsDocument from "../../../../models/AutomationAgentOsDocument";
import {
  AgentOsDocumentEntityType
} from "../../../../config/automationAgentOsPersistenceConstants";
import {
  assertCompanyId,
  getAgentOsPersistenceBackend,
  persistAsync
} from "../persistenceUtils";

export type DocumentRecord = {
  companyId: number;
  entityType: AgentOsDocumentEntityType | string;
  entityKey: string;
  payload: Record<string, unknown>;
  version?: number;
  status?: string | null;
  agentId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * DocumentRepository — Learning + secondary Multi-Agent/cognitive entities.
 */
export class DocumentRepository {
  async upsert(
    input: DocumentRecord,
    transaction?: Transaction
  ): Promise<DocumentRecord> {
    const companyId = assertCompanyId(input.companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return input;

    const existing = await AutomationAgentOsDocument.findOne({
      where: {
        companyId,
        entityType: input.entityType,
        entityKey: input.entityKey
      },
      transaction
    });

    if (existing) {
      await existing.update(
        {
          payload: input.payload,
          version: (existing.version || 1) + 1,
          status: input.status ?? existing.status,
          agentId: input.agentId ?? existing.agentId,
          sessionId: input.sessionId ?? existing.sessionId,
          metadata: input.metadata ?? existing.metadata
        },
        { transaction }
      );
      return {
        ...input,
        version: existing.version
      };
    }

    await AutomationAgentOsDocument.create(
      {
        companyId,
        entityType: input.entityType,
        entityKey: input.entityKey,
        payload: input.payload,
        version: input.version || 1,
        status: input.status ?? null,
        agentId: input.agentId ?? null,
        sessionId: input.sessionId ?? null,
        metadata: input.metadata ?? null
      } as any,
      { transaction }
    );
    return input;
  }

  upsertFireAndForget(input: DocumentRecord): void {
    persistAsync(() => this.upsert(input), `doc.${input.entityType}`);
  }

  async get(
    companyId: number,
    entityType: string,
    entityKey: string
  ): Promise<DocumentRecord | null> {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return null;
    const row = await AutomationAgentOsDocument.findOne({
      where: { companyId, entityType, entityKey }
    });
    if (!row) return null;
    return {
      companyId: row.companyId,
      entityType: row.entityType,
      entityKey: row.entityKey,
      payload: row.payload,
      version: row.version,
      status: row.status,
      agentId: row.agentId,
      sessionId: row.sessionId,
      metadata: row.metadata
    };
  }

  async list(
    companyId: number,
    entityType: string,
    limit = 500
  ): Promise<DocumentRecord[]> {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return [];
    const rows = await AutomationAgentOsDocument.findAll({
      where: { companyId, entityType },
      order: [["updatedAt", "DESC"]],
      limit
    });
    return rows.map(row => ({
      companyId: row.companyId,
      entityType: row.entityType,
      entityKey: row.entityKey,
      payload: row.payload,
      version: row.version,
      status: row.status,
      agentId: row.agentId,
      sessionId: row.sessionId,
      metadata: row.metadata
    }));
  }

  async delete(
    companyId: number,
    entityType: string,
    entityKey: string
  ): Promise<boolean> {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return false;
    const n = await AutomationAgentOsDocument.destroy({
      where: { companyId, entityType, entityKey }
    });
    return n > 0;
  }
}

export const documentRepository = new DocumentRepository();
export default documentRepository;
