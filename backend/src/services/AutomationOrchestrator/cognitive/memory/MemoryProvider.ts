import { KnowledgeObject, MemoryQuery } from "./memoryTypes";

/**
 * MemoryProvider — contrato de armazenamento.
 * Implementações concretas conhecem storage; o Memory Engine não.
 */
export interface MemoryProvider {
  readonly name: string;

  save(object: KnowledgeObject): Promise<KnowledgeObject>;

  search(query: MemoryQuery): Promise<KnowledgeObject[]>;

  update(
    tenantId: number,
    id: string,
    patch: Partial<KnowledgeObject>
  ): Promise<KnowledgeObject | null>;

  delete(tenantId: number, id: string): Promise<boolean>;

  list(tenantId: number, limit?: number): Promise<KnowledgeObject[]>;

  getById(tenantId: number, id: string): Promise<KnowledgeObject | null>;

  countByType?(tenantId: number): Promise<Record<string, number>>;
}

/**
 * VectorProvider — contrato futuro. NÃO implementar embeddings nesta fase.
 */
export interface VectorProvider {
  readonly name: string;
  readonly implemented: false;

  searchSimilar(_input: {
    tenantId: number;
    vector: number[];
    limit?: number;
  }): Promise<never>;

  index(_input: {
    tenantId: number;
    id: string;
    vector: number[];
    metadata?: Record<string, unknown>;
  }): Promise<never>;

  delete(_input: { tenantId: number; id: string }): Promise<never>;
}

export type { KnowledgeObject, MemoryQuery };
