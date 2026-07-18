import AppError from "../../../errors/AppError";
import {
  isKnowledgeVectorStoreFallbackAllowed,
  resolveKnowledgeVectorStoreDriver
} from "../../../config/knowledgeBaseConstants";
import {
  resolveEmbeddingModelConfiguration
} from "../../../config/knowledgeEmbeddingModels";
import ByteaCosineVectorStore from "./ByteaCosineVectorStore";
import PgVectorStore from "./PgVectorStore";
import type { KnowledgeVectorStore } from "./types";

export async function assertVectorStoreReadyForModel(input: {
  provider: string;
  model: string;
}): Promise<ResolvedStorePlan> {
  const cfg = resolveEmbeddingModelConfiguration(input.provider, input.model);
  const driver = resolveKnowledgeVectorStoreDriver();

  if (driver === "bytea_cosine") {
    return {
      store: new ByteaCosineVectorStore(),
      configuration: cfg,
      usingFallback: false
    };
  }

  if (cfg.vectorStoreCompatibility === "unsupported") {
    throw new AppError(
      "ERR_KNOWLEDGE_VECTOR_DIMENSION_UNSUPPORTED",
      400,
      `O modelo ${cfg.model} (${cfg.dimensions}d) não é compatível com o VectorStore pgvector configurado.`
    );
  }

  const pg = new PgVectorStore();
  try {
    await pg.assertSupportsDimensions(cfg.dimensions);
    return { store: pg, configuration: cfg, usingFallback: false };
  } catch (err) {
    if (
      err instanceof AppError &&
      err.message === "ERR_KNOWLEDGE_VECTOR_FALLBACK" &&
      isKnowledgeVectorStoreFallbackAllowed()
    ) {
      return {
        store: new ByteaCosineVectorStore(),
        configuration: cfg,
        usingFallback: true
      };
    }
    // Sem flag de fallback: exigir falha clara (não silenciar para BYTEA).
    throw err;
  }
}

export type ResolvedStorePlan = {
  store: KnowledgeVectorStore;
  configuration: ReturnType<typeof resolveEmbeddingModelConfiguration>;
  usingFallback: boolean;
};

export function resolveKnowledgeVectorStore(): KnowledgeVectorStore {
  const driver = resolveKnowledgeVectorStoreDriver();
  if (driver === "pgvector") {
    return new PgVectorStore();
  }
  return new ByteaCosineVectorStore();
}

export { ByteaCosineVectorStore, PgVectorStore };
export * from "./types";
