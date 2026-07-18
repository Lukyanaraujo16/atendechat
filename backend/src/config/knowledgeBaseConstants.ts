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

/** Fase 1.5.2C fará a indexação vetorial; nesta fase permanece sempre pending. */
export const KNOWLEDGE_INDEX_STATUSES = ["pending"] as const;

export type KnowledgeIndexStatus = (typeof KNOWLEDGE_INDEX_STATUSES)[number];

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

export const KNOWLEDGE_BASE_FEATURE_KEY = "automation.knowledge_base";
