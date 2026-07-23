import { MemoryProvider } from "../MemoryProvider";
import { KnowledgeObject, MemoryQuery } from "../memoryTypes";
import { cognitiveMemoryRepository } from "../../../persistence/repositories/CognitiveMemoryRepository";
import { getAgentOsPersistenceBackend } from "../../../../../config/automationAgentOsPersistenceConstants";

/**
 * SqlMemoryProvider — tenant-scoped KnowledgeObject storage.
 * V2.10: cache in-process + write-through Sequelize via CognitiveMemoryRepository.
 * Memory Engine API unchanged.
 */
export class SqlMemoryProvider implements MemoryProvider {
  readonly name = "SqlMemoryProvider";

  private readonly tables = new Map<number, Map<string, KnowledgeObject>>();
  private readonly hydrated = new Set<number>();

  private table(tenantId: number): Map<string, KnowledgeObject> {
    if (!this.tables.has(tenantId)) {
      this.tables.set(tenantId, new Map());
    }
    return this.tables.get(tenantId)!;
  }

  private async ensureHydrated(tenantId: number): Promise<void> {
    if (
      getAgentOsPersistenceBackend() !== "sequelize" ||
      this.hydrated.has(tenantId)
    ) {
      return;
    }
    this.hydrated.add(tenantId);
    try {
      const rows = await cognitiveMemoryRepository.hydrateCompany(tenantId);
      const t = this.table(tenantId);
      for (const row of rows) t.set(row.id, row);
    } catch {
      // cache remains empty; writes still fire-and-forget
    }
  }

  async save(object: KnowledgeObject): Promise<KnowledgeObject> {
    const t = this.table(object.tenantId);
    t.set(object.id, { ...object });
    cognitiveMemoryRepository.saveFireAndForget(object);
    return { ...object };
  }

  async getById(
    tenantId: number,
    id: string
  ): Promise<KnowledgeObject | null> {
    await this.ensureHydrated(tenantId);
    const cached = this.table(tenantId).get(id);
    if (cached) return { ...cached };
    if (getAgentOsPersistenceBackend() === "sequelize") {
      const fromDb = await cognitiveMemoryRepository.getById(tenantId, id);
      if (fromDb) {
        this.table(tenantId).set(fromDb.id, fromDb);
        return { ...fromDb };
      }
    }
    return null;
  }

  async update(
    tenantId: number,
    id: string,
    patch: Partial<KnowledgeObject>
  ): Promise<KnowledgeObject | null> {
    await this.ensureHydrated(tenantId);
    const t = this.table(tenantId);
    const current = t.get(id);
    if (!current) return null;
    const next: KnowledgeObject = {
      ...current,
      ...patch,
      id: current.id,
      tenantId: current.tenantId,
      updatedAt: new Date().toISOString(),
      version: (current.version || 1) + 1
    };
    t.set(id, next);
    cognitiveMemoryRepository.saveFireAndForget(next);
    return { ...next };
  }

  async delete(tenantId: number, id: string): Promise<boolean> {
    const ok = this.table(tenantId).delete(id);
    if (ok && getAgentOsPersistenceBackend() === "sequelize") {
      void cognitiveMemoryRepository.delete(tenantId, id);
    }
    return ok;
  }

  async list(tenantId: number, limit = 100): Promise<KnowledgeObject[]> {
    await this.ensureHydrated(tenantId);
    const rows = Array.from(this.table(tenantId).values());
    return rows
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map(o => ({ ...o }));
  }

  async search(query: MemoryQuery): Promise<KnowledgeObject[]> {
    const tenantId = query.tenantId;
    await this.ensureHydrated(tenantId);
    let rows = Array.from(this.table(tenantId).values());

    if (query.memoryType) {
      const types = Array.isArray(query.memoryType)
        ? query.memoryType
        : [query.memoryType];
      rows = rows.filter(r => types.includes(r.memoryType));
    }
    if (query.agentId != null) {
      rows = rows.filter(r => r.agentId === query.agentId);
    }
    if (query.ticketId != null) {
      rows = rows.filter(r => r.ticketId === query.ticketId);
    }
    if (query.contactId != null) {
      rows = rows.filter(r => r.contactId === query.contactId);
    }
    if (query.goalId) {
      rows = rows.filter(r => r.goalId === query.goalId);
    }
    if (query.executionId) {
      rows = rows.filter(r => r.executionId === query.executionId);
    }
    if (query.importanceMin != null) {
      rows = rows.filter(r => r.importance >= query.importanceMin!);
    }
    if (query.confidenceMin != null) {
      rows = rows.filter(r => r.confidence >= query.confidenceMin!);
    }
    if (query.tags?.length) {
      rows = rows.filter(r =>
        query.tags!.every(tag => r.tags.includes(tag))
      );
    }
    if (query.dateRange?.from) {
      rows = rows.filter(r => r.createdAt >= query.dateRange!.from!);
    }
    if (query.dateRange?.to) {
      rows = rows.filter(r => r.createdAt <= query.dateRange!.to!);
    }
    if (query.text) {
      const q = query.text.toLowerCase();
      rows = rows.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    const limit = query.limit || 50;
    return rows
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map(o => ({ ...o }));
  }

  async countByType(tenantId: number): Promise<Record<string, number>> {
    await this.ensureHydrated(tenantId);
    const counts: Record<string, number> = {};
    for (const obj of this.table(tenantId).values()) {
      counts[obj.memoryType] = (counts[obj.memoryType] || 0) + 1;
    }
    return counts;
  }

  __reset(tenantId?: number): void {
    if (tenantId != null) {
      this.tables.delete(tenantId);
      this.hydrated.delete(tenantId);
    } else {
      this.tables.clear();
      this.hydrated.clear();
    }
  }
}

export const defaultSqlMemoryProvider = new SqlMemoryProvider();

export default defaultSqlMemoryProvider;
