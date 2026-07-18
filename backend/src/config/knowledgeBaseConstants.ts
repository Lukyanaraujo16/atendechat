/** Tipos semânticos de documento (preparação para RAG futuro — só armazenamento + classificação). */
export const KNOWLEDGE_DOCUMENT_TYPES = [
  "general",
  "faq",
  "product",
  "service",
  "price_table",
  "procedure",
  "policy",
  "contract",
  "catalog",
  "manual",
  "website",
  "other"
] as const;

export type KnowledgeDocumentType = (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];

export const KNOWLEDGE_SOURCE_TYPES = [
  "manual",
  "upload",
  "website",
  "future_api"
] as const;

export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

/**
 * Status editorial legado (rascunho / pronto).
 * O pipeline de extração usa uploadStatus / processingStatus / indexStatus.
 */
export const KNOWLEDGE_DOCUMENT_STATUSES = [
  "draft",
  "ready",
  "processing",
  "error"
] as const;

export type KnowledgeDocumentStatus = (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number];

export const KNOWLEDGE_UPLOAD_STATUSES = [
  "pending",
  "uploaded",
  "failed"
] as const;

export type KnowledgeUploadStatus = (typeof KNOWLEDGE_UPLOAD_STATUSES)[number];

export const KNOWLEDGE_PROCESSING_STATUSES = [
  "pending",
  "queued",
  "processing",
  "completed",
  "failed"
] as const;

export type KnowledgeProcessingStatus =
  (typeof KNOWLEDGE_PROCESSING_STATUSES)[number];

/** Pipeline de indexação vetorial (fase 1.5.2C). */
export const KNOWLEDGE_INDEX_STATUSES = [
  "pending",
  "queued",
  "indexing",
  "completed",
  "failed",
  "outdated"
] as const;

export type KnowledgeIndexStatus = (typeof KNOWLEDGE_INDEX_STATUSES)[number];

export const KNOWLEDGE_INDEXING_RECORD_STATUSES = [
  "queued",
  "chunking",
  "embedding",
  "storing",
  "completed",
  "failed",
  "cancelled",
  "skipped"
] as const;

export type KnowledgeIndexingRecordStatus =
  (typeof KNOWLEDGE_INDEXING_RECORD_STATUSES)[number];

export const KNOWLEDGE_PROCESSING_RECORD_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed"
] as const;

export type KnowledgeProcessingRecordStatus =
  (typeof KNOWLEDGE_PROCESSING_RECORD_STATUSES)[number];

export const KNOWLEDGE_PROCESSORS = [
  "txt",
  "markdown",
  "pdf",
  "docx",
  "website",
  "manual"
] as const;

export type KnowledgeProcessorName = (typeof KNOWLEDGE_PROCESSORS)[number];

/** Extensões/MIME permitidos para upload (armazenamento bruto). */
export const KNOWLEDGE_UPLOAD_ALLOWED_EXTENSIONS = [
  ".txt",
  ".md",
  ".pdf",
  ".docx"
] as const;

export const KNOWLEDGE_UPLOAD_ALLOWED_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword"
] as const;

/** Limite de armazenamento de upload (fase 1.5.2A). */
export const KNOWLEDGE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

/** Limite para processamento/extração nesta fase (1.5.2B). */
export const KNOWLEDGE_PROCESSING_MAX_BYTES = 5 * 1024 * 1024;

/** Timeout de um job de processamento (ms). */
export const KNOWLEDGE_PROCESSING_TIMEOUT_MS = 90_000;

/** Timeout de um job de indexação (ms). */
export const KNOWLEDGE_INDEXING_TIMEOUT_MS = 300_000;

/** Versão do algoritmo de chunking (invalidação ao mudar). */
export const KNOWLEDGE_CHUNKING_VERSION = "1.0.0";

/** Defaults de chunking (configuráveis por empresa). */
export const KNOWLEDGE_DEFAULT_CHUNK_SIZE = 800;
export const KNOWLEDGE_DEFAULT_CHUNK_OVERLAP = 120;
export const KNOWLEDGE_DEFAULT_MIN_CHUNK_SIZE = 40;
export const KNOWLEDGE_DEFAULT_EMBEDDING_BATCH_SIZE = 16;

/** Máximo de candidatos carregados na busca cosine filtrada (BYTEA). */
export const KNOWLEDGE_SEARCH_CANDIDATE_LIMIT = 2500;

/** Máximo de documentos enfileirados por ação em lote. */
export const KNOWLEDGE_INDEX_BATCH_MAX = 50;

export const KNOWLEDGE_BASE_FEATURE_KEY = "automation.knowledge_base";

/**
 * Driver de vector store:
 * - `bytea_cosine` (padrão): BYTEA float32 + cosine filtrado por tenant (sem extensão).
 * - `pgvector`: colunas vector(768|1536|3072); exige extensão e migration corretiva.
 *
 * Fallback BYTEA quando `pgvector` está configurado só é permitido se
 * `KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK=true` (dev/testes). Em produção falha.
 */
export type KnowledgeVectorStoreDriver = "bytea_cosine" | "pgvector";

export function resolveKnowledgeVectorStoreDriver(): KnowledgeVectorStoreDriver {
  const raw = String(process.env.KNOWLEDGE_VECTOR_STORE || "bytea_cosine")
    .trim()
    .toLowerCase();
  if (raw === "pgvector") return "pgvector";
  return "bytea_cosine";
}

export function isKnowledgeVectorStoreFallbackAllowed(): boolean {
  const raw = String(process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
