import {
  AI_PROVIDER_GEMINI,
  AI_PROVIDER_OPENAI,
  AiProviderId,
  isAiProviderId
} from "./aiProviderModels";
import AppError from "../errors/AppError";
import {
  KnowledgeVectorStoreDriver,
  resolveKnowledgeVectorStoreDriver
} from "./knowledgeBaseConstants";

export type KnowledgeEmbeddingModelDef = {
  provider: AiProviderId;
  model: string;
  dimensions: number;
  /** Versão lógica para invalidação de índice. */
  embeddingVersion: string;
  batchSupport: boolean;
  /** Dimensões suportadas pelo adapter pgvector do projeto. */
  pgvectorSupported: boolean;
};

/** Dimensões com coluna pgvector dedicada. */
export const KNOWLEDGE_PGVECTOR_DIMENSIONS = [768, 1536, 3072] as const;
export type KnowledgePgVectorDimension =
  (typeof KNOWLEDGE_PGVECTOR_DIMENSIONS)[number];

export function pgVectorColumnForDimensions(
  dimensions: number
): "embeddingVector768" | "embeddingVector1536" | "embeddingVector3072" | null {
  if (dimensions === 768) return "embeddingVector768";
  if (dimensions === 1536) return "embeddingVector1536";
  if (dimensions === 3072) return "embeddingVector3072";
  return null;
}

/** Modelos de embedding permitidos (separados dos modelos de chat). */
export const OPENAI_EMBEDDING_MODELS: readonly KnowledgeEmbeddingModelDef[] = [
  {
    provider: AI_PROVIDER_OPENAI,
    model: "text-embedding-3-small",
    dimensions: 1536,
    embeddingVersion: "openai-text-embedding-3-small-v1",
    batchSupport: true,
    pgvectorSupported: true
  },
  {
    provider: AI_PROVIDER_OPENAI,
    model: "text-embedding-3-large",
    dimensions: 3072,
    embeddingVersion: "openai-text-embedding-3-large-v1",
    batchSupport: true,
    pgvectorSupported: true
  },
  {
    provider: AI_PROVIDER_OPENAI,
    model: "text-embedding-ada-002",
    dimensions: 1536,
    embeddingVersion: "openai-text-embedding-ada-002-v1",
    batchSupport: true,
    pgvectorSupported: true
  }
];

export const GEMINI_EMBEDDING_MODELS: readonly KnowledgeEmbeddingModelDef[] = [
  {
    provider: AI_PROVIDER_GEMINI,
    model: "text-embedding-004",
    dimensions: 768,
    embeddingVersion: "gemini-text-embedding-004-v1",
    batchSupport: false,
    pgvectorSupported: true
  },
  {
    provider: AI_PROVIDER_GEMINI,
    model: "embedding-001",
    dimensions: 768,
    embeddingVersion: "gemini-embedding-001-v1",
    batchSupport: false,
    pgvectorSupported: true
  }
];

const ALL = [...OPENAI_EMBEDDING_MODELS, ...GEMINI_EMBEDDING_MODELS];

export const DEFAULT_EMBEDDING_MODEL_BY_PROVIDER: Record<
  AiProviderId,
  string
> = {
  [AI_PROVIDER_OPENAI]: "text-embedding-3-small",
  [AI_PROVIDER_GEMINI]: "text-embedding-004"
};

export function getEmbeddingModelsForProvider(
  provider: AiProviderId
): readonly KnowledgeEmbeddingModelDef[] {
  return ALL.filter(m => m.provider === provider);
}

export function resolveEmbeddingModelDef(
  provider: string,
  model: string
): KnowledgeEmbeddingModelDef | null {
  if (!isAiProviderId(provider)) return null;
  return ALL.find(m => m.provider === provider && m.model === model) || null;
}

export function isEmbeddingModelAllowed(
  provider: string,
  model: string
): boolean {
  return resolveEmbeddingModelDef(provider, model) != null;
}

export type ResolvedEmbeddingModelConfiguration = {
  provider: AiProviderId;
  model: string;
  dimensions: number;
  embeddingVersion: string;
  batchSupport: boolean;
  pgvectorSupported: boolean;
  vectorStoreDriver: KnowledgeVectorStoreDriver;
  vectorStoreCompatibility: "ok" | "bytea_only" | "unsupported";
  pgvectorColumn:
    | "embeddingVector768"
    | "embeddingVector1536"
    | "embeddingVector3072"
    | null;
};

/**
 * Catálogo canónico: dimensão e compatibilidade vêm do backend, nunca do frontend.
 */
export function resolveEmbeddingModelConfiguration(
  provider: string,
  model: string
): ResolvedEmbeddingModelConfiguration {
  const def = resolveEmbeddingModelDef(provider, model);
  if (!def) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_MODEL",
      400,
      "Modelo de embedding não permitido."
    );
  }
  const driver = resolveKnowledgeVectorStoreDriver();
  const pgvectorColumn = pgVectorColumnForDimensions(def.dimensions);
  let vectorStoreCompatibility: ResolvedEmbeddingModelConfiguration["vectorStoreCompatibility"] =
    "ok";
  if (driver === "pgvector") {
    if (!def.pgvectorSupported || !pgvectorColumn) {
      vectorStoreCompatibility = "unsupported";
    }
  } else {
    vectorStoreCompatibility = "bytea_only";
  }

  return {
    provider: def.provider,
    model: def.model,
    dimensions: def.dimensions,
    embeddingVersion: def.embeddingVersion,
    batchSupport: def.batchSupport,
    pgvectorSupported: def.pgvectorSupported,
    vectorStoreDriver: driver,
    vectorStoreCompatibility,
    pgvectorColumn
  };
}

export function assertEmbeddingLengthMatchesDimensions(
  embedding: number[],
  dimensions: number
): void {
  if (!Array.isArray(embedding) || embedding.length !== dimensions) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_DIMENSION",
      502,
      `Dimensão de embedding incompatível: esperado ${dimensions}, recebido ${
        Array.isArray(embedding) ? embedding.length : 0
      }.`
    );
  }
}
