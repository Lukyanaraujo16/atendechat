export type KnowledgeRetrievalHit = {
  knowledgeBaseId: number;
  knowledgeBaseName: string | null;
  documentId: number;
  documentTitle: string | null;
  documentType: string | null;
  chunkId: number;
  chunkHash?: string | null;
  sectionTitle: string | null;
  content: string;
  similarityScore: number;
  sourceType: string | null;
  sourceUrl: string | null;
  language: string | null;
  priority: number;
  metadata?: Record<string, unknown> | null;
};

export type KnowledgeRetrievalMetrics = {
  durationMs: number;
  embeddingDurationMs: number;
  searchDurationMs: number;
  candidateCount: number;
  returnedChunkCount: number;
  returnedDocumentCount: number;
  estimatedContextTokens: number;
  contextCharacters: number;
  provider: string;
  model: string;
  dimensions: number;
  truncated: boolean;
};

export type KnowledgeRetrievalSource = {
  knowledgeBaseId: number;
  knowledgeBaseName: string | null;
  documentId: number;
  documentTitle: string | null;
  documentType: string | null;
  chunkId: number;
  sectionTitle: string | null;
  similarityScore: number;
  sourceType: string | null;
  sourceUrl: string | null;
  language: string | null;
  priority: number;
};

export type KnowledgeRetrievalResult = {
  enabled: boolean;
  performed: boolean;
  skippedReason: string | null;
  status: "skipped" | "completed" | "empty" | "failed";
  queryUsed: string;
  results: KnowledgeRetrievalHit[];
  contextText: string;
  sources: KnowledgeRetrievalSource[];
  metrics: KnowledgeRetrievalMetrics;
  errorCode?: string | null;
  errorMessage?: string | null;
  knowledgeMissing: boolean;
  suggestHandoff: boolean;
  allowAnswerWithoutKnowledge: boolean;
  retrievalId?: number | null;
};
