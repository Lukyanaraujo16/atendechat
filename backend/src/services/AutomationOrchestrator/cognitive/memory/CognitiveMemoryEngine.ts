import { createHash } from "crypto";
import { MemoryEventName } from "../../../../config/automationCognitiveMemoryConstants";
import { getCognitiveMemoryConfig } from "./CognitiveMemoryConfig";
import { MemoryProvider } from "./MemoryProvider";
import { defaultSqlMemoryProvider } from "./providers/SqlMemoryProvider";
import { MemoryRetriever } from "./MemoryRetriever";
import {
  KnowledgeObject,
  MemoryEvent,
  MemoryQuery,
  ScoredMemory
} from "./memoryTypes";
import {
  recordMemoryEvent,
  recordMemoryMutation
} from "./CognitiveMemoryMetrics";

export type CognitiveMemoryEngineOptions = {
  provider?: MemoryProvider;
  onEvent?: (event: MemoryEvent) => void;
};

function newEventId(seed: string): string {
  return `mevt_${createHash("sha256")
    .update(`${seed}:${Date.now()}`)
    .digest("hex")
    .slice(0, 12)}`;
}

/**
 * CognitiveMemoryEngine — fachada única de memória.
 * Nunca conhece banco/vector/embeddings/providers LLM diretamente.
 */
export class CognitiveMemoryEngine {
  private readonly provider: MemoryProvider;
  private readonly retriever: MemoryRetriever;
  private readonly onEvent?: (event: MemoryEvent) => void;

  constructor(options: CognitiveMemoryEngineOptions = {}) {
    this.provider = options.provider || defaultSqlMemoryProvider;
    this.retriever = new MemoryRetriever(this.provider);
    this.onEvent = options.onEvent;
  }

  private emit(
    tenantId: number,
    name: MemoryEventName,
    memoryId?: string,
    message?: string,
    meta?: Record<string, unknown>
  ): MemoryEvent {
    const event: MemoryEvent = {
      id: newEventId(`${tenantId}:${name}`),
      tenantId,
      memoryId,
      name,
      at: new Date().toISOString(),
      message,
      meta
    };
    recordMemoryEvent(event);
    this.onEvent?.(event);
    return event;
  }

  async save(
    object: KnowledgeObject
  ): Promise<{ object: KnowledgeObject; event: MemoryEvent }> {
    const cfg = getCognitiveMemoryConfig(object.tenantId);
    if (object.memoryType === "WORKING" && !cfg.workingMemory.enabled) {
      throw new Error("working_memory_disabled");
    }
    if (object.memoryType === "WORKING" && !cfg.workingMemory.persist) {
      // still save via provider but mark non-persistent
      object = {
        ...object,
        metadata: { ...object.metadata, persistent: false }
      };
    }

    const count = (await this.provider.list(object.tenantId, 10_000)).length;
    if (count >= cfg.limits.maxObjectsPerTenant) {
      throw new Error("tenant_memory_limit_reached");
    }

    const saved = await this.provider.save(object);
    recordMemoryMutation("created", saved.memoryType);
    const event = this.emit(
      saved.tenantId,
      "MEMORY_CREATED",
      saved.id,
      saved.title,
      { memoryType: saved.memoryType }
    );
    return { object: saved, event };
  }

  async saveMany(
    objects: KnowledgeObject[]
  ): Promise<{ objects: KnowledgeObject[]; events: MemoryEvent[] }> {
    const saved: KnowledgeObject[] = [];
    const events: MemoryEvent[] = [];
    for (const obj of objects) {
      const result = await this.save(obj);
      saved.push(result.object);
      events.push(result.event);
      events.push(
        this.emit(
          obj.tenantId,
          "KNOWLEDGE_CREATED",
          result.object.id,
          result.object.title
        )
      );
    }
    return { objects: saved, events };
  }

  async get(
    tenantId: number,
    id: string
  ): Promise<KnowledgeObject | null> {
    return this.provider.getById(tenantId, id);
  }

  async update(
    tenantId: number,
    id: string,
    patch: Partial<KnowledgeObject>
  ): Promise<{ object: KnowledgeObject | null; event?: MemoryEvent }> {
    // strip tenantId from patch to enforce isolation
    const { tenantId: _t, id: _i, ...safe } = patch as any;
    const updated = await this.provider.update(tenantId, id, safe);
    if (!updated) return { object: null };
    recordMemoryMutation("updated", updated.memoryType);
    const event = this.emit(
      tenantId,
      "MEMORY_UPDATED",
      id,
      "versioned update",
      { version: updated.version }
    );
    return { object: updated, event };
  }

  async delete(
    tenantId: number,
    id: string
  ): Promise<{ deleted: boolean; event?: MemoryEvent }> {
    const deleted = await this.provider.delete(tenantId, id);
    if (!deleted) return { deleted: false };
    recordMemoryMutation("deleted");
    const event = this.emit(tenantId, "MEMORY_DELETED", id);
    return { deleted: true, event };
  }

  async list(tenantId: number, limit?: number): Promise<KnowledgeObject[]> {
    return this.provider.list(tenantId, limit);
  }

  async query(query: MemoryQuery): Promise<{
    results: ScoredMemory[];
    event: MemoryEvent;
  }> {
    const results = await this.retriever.retrieve(query);
    recordMemoryMutation("retrieval");
    const event = this.emit(
      query.tenantId,
      "MEMORY_RETRIEVED",
      undefined,
      `${results.length} results`,
      { count: results.length, memoryType: query.memoryType }
    );
    return { results, event };
  }

  async countByType(tenantId: number): Promise<Record<string, number>> {
    if (this.provider.countByType) {
      return this.provider.countByType(tenantId);
    }
    const all = await this.provider.list(tenantId, 10_000);
    const counts: Record<string, number> = {};
    for (const o of all) {
      counts[o.memoryType] = (counts[o.memoryType] || 0) + 1;
    }
    return counts;
  }
}

export default CognitiveMemoryEngine;
