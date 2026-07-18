export type VectorSearchFilter = {
  companyId: number;
  knowledgeBaseIds?: number[];
  documentTypes?: string[];
  languages?: string[];
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
  limit: number;
  minimumScore?: number;
  candidateLimit?: number;
};

export type VectorSearchHit = {
  chunkId: number;
  knowledgeDocumentId: number;
  knowledgeBaseId: number;
  content: string;
  title: string | null;
  sectionTitle: string | null;
  documentType: string | null;
  language: string | null;
  sourceType: string | null;
  metadata: Record<string, unknown> | null;
  score: number;
};

export type VectorPersistInput = {
  chunkId: number;
  embedding: number[];
  dimensions: number;
};

/**
 * Adapter de armazenamento vetorial.
 * A aplicação não precisa conhecer colunas físicas 768/1536/3072.
 */
export interface KnowledgeVectorStore {
  readonly kind: "bytea_cosine_filtered" | "pgvector";
  /** Valida se esta store consegue operar com a dimensão configurada. */
  assertSupportsDimensions(dimensions: number): void | Promise<void>;
  /** Persiste vetor na representação física adequada (além do BYTEA canónico). */
  persistEmbedding?(input: VectorPersistInput): Promise<void>;
  searchByEmbedding(
    queryEmbedding: number[],
    filter: VectorSearchFilter
  ): Promise<VectorSearchHit[]>;
}
