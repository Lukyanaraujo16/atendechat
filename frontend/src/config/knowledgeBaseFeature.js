/** Chave estável no catálogo PlanFeatures (grupo automation). */
export const KNOWLEDGE_BASE_FEATURE_KEY = "automation.knowledge_base";

/** Rota do módulo Base de Conhecimento. */
export const KNOWLEDGE_BASE_ROUTE_PATH = "/knowledge-base";

/** Detalhe de uma base. */
export const KNOWLEDGE_BASE_DETAIL_ROUTE_PATH = "/knowledge-base/:baseId";

/**
 * Controla exibição da aba/menu da Base de Conhecimento.
 */
export const KNOWLEDGE_BASE_UI_ENABLED = true;

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
  "other",
];

export const KNOWLEDGE_SOURCE_TYPES = [
  "manual",
  "upload",
  "website",
  "future_api",
];

export const KNOWLEDGE_DOCUMENT_STATUSES = [
  "draft",
  "ready",
  "processing",
  "error",
];

export const KNOWLEDGE_PROCESSING_STATUSES = [
  "pending",
  "queued",
  "processing",
  "completed",
  "failed",
];

export const KNOWLEDGE_LANGUAGES = ["pt-BR", "en-US", "es"];
