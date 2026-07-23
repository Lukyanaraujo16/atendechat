import { Op, Transaction } from "sequelize";
import AutomationCognitiveMemory from "../../../../models/AutomationCognitiveMemory";
import { KnowledgeObject, MemoryQuery } from "../../cognitive/memory/memoryTypes";
import {
  assertCompanyId,
  encryptAgentOsPayload,
  decryptAgentOsPayload,
  getAgentOsPersistenceBackend,
  persistAsync
} from "../persistenceUtils";

function shouldEncryptContent(): boolean {
  return process.env.AGENTOS_ENCRYPT_MEMORY === "true";
}

function toObject(row: AutomationCognitiveMemory): KnowledgeObject {
  let content = row.content || "";
  if (row.contentEncrypted && content) {
    try {
      content = decryptAgentOsPayload(content);
    } catch {
      content = "";
    }
  }
  return {
    id: row.id,
    memoryType: row.memoryType as KnowledgeObject["memoryType"],
    tenantId: row.companyId,
    agentId: row.agentId,
    ticketId: row.ticketId,
    contactId: row.contactId,
    goalId: row.goalId,
    executionId: row.executionId,
    title: row.title,
    summary: row.summary || "",
    content,
    entities: (row.entities as KnowledgeObject["entities"]) || [],
    tags: (row.tags as string[]) || [],
    confidence: row.confidence ?? 0,
    importance: row.importance ?? 0,
    source: row.source || "system",
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: row.metadata || {}
  };
}

/**
 * CognitiveMemoryRepository — Sequelize boundary for KnowledgeObjects.
 * Cache in SqlMemoryProvider remains for sync engine access.
 */
export class CognitiveMemoryRepository {
  async save(
    object: KnowledgeObject,
    transaction?: Transaction
  ): Promise<KnowledgeObject> {
    const companyId = assertCompanyId(object.tenantId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return object;

    const encrypt = shouldEncryptContent();
    const content = encrypt
      ? encryptAgentOsPayload(object.content || "")
      : object.content || "";

    await AutomationCognitiveMemory.upsert(
      {
        id: object.id,
        companyId,
        memoryType: object.memoryType,
        agentId: object.agentId,
        ticketId: object.ticketId,
        contactId: object.contactId,
        goalId: object.goalId,
        executionId: object.executionId,
        title: object.title,
        summary: object.summary,
        content,
        contentEncrypted: encrypt,
        entities: object.entities,
        tags: object.tags,
        confidence: object.confidence,
        importance: object.importance,
        source: String(object.source),
        version: object.version,
        metadata: object.metadata
      } as any,
      { transaction }
    );
    return object;
  }

  saveFireAndForget(object: KnowledgeObject): void {
    persistAsync(() => this.save(object), "cognitiveMemory.save");
  }

  async getById(
    companyId: number,
    id: string
  ): Promise<KnowledgeObject | null> {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return null;
    const row = await AutomationCognitiveMemory.findOne({
      where: { companyId, id }
    });
    return row ? toObject(row) : null;
  }

  async list(companyId: number, limit = 100): Promise<KnowledgeObject[]> {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return [];
    const rows = await AutomationCognitiveMemory.findAll({
      where: { companyId },
      order: [["updatedAt", "DESC"]],
      limit
    });
    return rows.map(toObject);
  }

  async search(query: MemoryQuery): Promise<KnowledgeObject[]> {
    const companyId = assertCompanyId(query.tenantId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return [];
    const where: any = { companyId };
    if (query.memoryType) {
      const types = Array.isArray(query.memoryType)
        ? query.memoryType
        : [query.memoryType];
      where.memoryType = { [Op.in]: types };
    }
    if (query.agentId != null) where.agentId = query.agentId;
    if (query.ticketId != null) where.ticketId = query.ticketId;
    if (query.contactId != null) where.contactId = query.contactId;
    if (query.goalId) where.goalId = query.goalId;
    if (query.executionId) where.executionId = query.executionId;
    if (query.importanceMin != null) {
      where.importance = { [Op.gte]: query.importanceMin };
    }
    if (query.confidenceMin != null) {
      where.confidence = { ...(where.confidence || {}), [Op.gte]: query.confidenceMin };
    }

    const rows = await AutomationCognitiveMemory.findAll({
      where,
      order: [["importance", "DESC"], ["updatedAt", "DESC"]],
      limit: query.limit || 50
    });
    let results = rows.map(toObject);
    if (query.tags?.length) {
      results = results.filter(r =>
        query.tags!.every(t => (r.tags || []).includes(t))
      );
    }
    if (query.text) {
      const q = query.text.toLowerCase();
      results = results.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q)
      );
    }
    return results;
  }

  async delete(companyId: number, id: string): Promise<boolean> {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return false;
    const n = await AutomationCognitiveMemory.destroy({
      where: { companyId, id }
    });
    return n > 0;
  }

  async hydrateCompany(companyId: number): Promise<KnowledgeObject[]> {
    return this.list(companyId, 5000);
  }
}

export const cognitiveMemoryRepository = new CognitiveMemoryRepository();
export default cognitiveMemoryRepository;
