import sequelize from "../../../database";
import AppError from "../../../errors/AppError";
import {
  isKnowledgeVectorStoreFallbackAllowed
} from "../../../config/knowledgeBaseConstants";
import {
  assertEmbeddingLengthMatchesDimensions,
  pgVectorColumnForDimensions
} from "../../../config/knowledgeEmbeddingModels";
import { logger } from "../../../utils/logger";
import ByteaCosineVectorStore from "./ByteaCosineVectorStore";
import type {
  KnowledgeVectorStore,
  VectorPersistInput,
  VectorSearchFilter,
  VectorSearchHit
} from "./types";

type PgVectorAvailability = {
  extension: boolean;
  columns: {
    embeddingVector768: boolean;
    embeddingVector1536: boolean;
    embeddingVector3072: boolean;
  };
};

/**
 * pgvector com colunas tipadas por dimensão:
 * embeddingVector768 | embeddingVector1536 | embeddingVector3072
 *
 * Fallback para BYTEA só com KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK=true.
 */
export class PgVectorStore implements KnowledgeVectorStore {
  readonly kind = "pgvector" as const;
  private fallback = new ByteaCosineVectorStore();
  private availability: PgVectorAvailability | null = null;

  private async probe(): Promise<PgVectorAvailability> {
    if (this.availability) return this.availability;
    const result: PgVectorAvailability = {
      extension: false,
      columns: {
        embeddingVector768: false,
        embeddingVector1536: false,
        embeddingVector3072: false
      }
    };
    try {
      const [rows] = await sequelize.query(
        `SELECT 1 AS ok FROM pg_extension WHERE extname = 'vector' LIMIT 1`
      );
      result.extension = Array.isArray(rows) && rows.length > 0;
    } catch {
      result.extension = false;
    }

    if (result.extension) {
      for (const col of Object.keys(result.columns) as Array<
        keyof PgVectorAvailability["columns"]
      >) {
        try {
          await sequelize.query(
            `SELECT "${col}" FROM "AiKnowledgeDocumentChunks" LIMIT 0`
          );
          result.columns[col] = true;
        } catch {
          result.columns[col] = false;
        }
      }
    }

    this.availability = result;
    return result;
  }

  private async requireReady(dimensions: number): Promise<string> {
    const column = pgVectorColumnForDimensions(dimensions);
    if (!column) {
      throw new AppError(
        "ERR_KNOWLEDGE_VECTOR_DIMENSION_UNSUPPORTED",
        400,
        `Dimensão ${dimensions} não é suportada pelo VectorStore pgvector.`
      );
    }

    const avail = await this.probe();
    const columnOk =
      avail.extension &&
      avail.columns[column as keyof PgVectorAvailability["columns"]];

    if (!columnOk) {
      if (isKnowledgeVectorStoreFallbackAllowed()) {
        logger.warn(
          `[KB] pgvector indisponível para ${column}; fallback BYTEA autorizado por KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK`
        );
        throw new AppError(
          "ERR_KNOWLEDGE_VECTOR_FALLBACK",
          503,
          "pgvector indisponível; fallback BYTEA autorizado."
        );
      }
      throw new AppError(
        "ERR_KNOWLEDGE_VECTOR_STORE_UNAVAILABLE",
        503,
        "pgvector está configurado (KNOWLEDGE_VECTOR_STORE=pgvector), mas a extensão ou colunas vetoriais não estão disponíveis. Instale pgvector, rode as migrations e reinicie — ou use KNOWLEDGE_VECTOR_STORE=bytea_cosine / KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK=true em desenvolvimento."
      );
    }

    return column;
  }

  /**
   * Valida disponibilidade pgvector para a dimensão.
   * Com fallback autorizado, propaga ERR_KNOWLEDGE_VECTOR_FALLBACK para o
   * resolver trocar explicitamente para BYTEA (sem mascarar a falha).
   */
  async assertSupportsDimensions(dimensions: number): Promise<void> {
    await this.requireReady(dimensions);
  }

  async persistEmbedding(input: VectorPersistInput): Promise<void> {
    assertEmbeddingLengthMatchesDimensions(input.embedding, input.dimensions);
    let column: string;
    try {
      column = await this.requireReady(input.dimensions);
    } catch (err) {
      if (
        err instanceof AppError &&
        err.message === "ERR_KNOWLEDGE_VECTOR_FALLBACK"
      ) {
        return; // BYTEA já foi gravado pelo job
      }
      throw err;
    }

    const literal = `[${input.embedding.join(",")}]`;
    await sequelize.query(
      `UPDATE "AiKnowledgeDocumentChunks"
       SET "${column}" = :vector::vector
       WHERE id = :id`,
      { replacements: { vector: literal, id: input.chunkId } }
    );
  }

  async searchByEmbedding(
    queryEmbedding: number[],
    filter: VectorSearchFilter
  ): Promise<VectorSearchHit[]> {
    assertEmbeddingLengthMatchesDimensions(
      queryEmbedding,
      filter.embeddingDimensions
    );

    let column: string;
    try {
      column = await this.requireReady(filter.embeddingDimensions);
    } catch (err) {
      if (
        err instanceof AppError &&
        err.message === "ERR_KNOWLEDGE_VECTOR_FALLBACK"
      ) {
        return this.fallback.searchByEmbedding(queryEmbedding, filter);
      }
      throw err;
    }

    const limit = Math.max(1, filter.limit);
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const replacements: Record<string, unknown> = {
      companyId: filter.companyId,
      provider: filter.embeddingProvider,
      model: filter.embeddingModel,
      dimensions: filter.embeddingDimensions,
      limit,
      vector: vectorLiteral
    };

    let sql = `
      SELECT
        c.id AS "chunkId",
        c."knowledgeDocumentId",
        c."knowledgeBaseId",
        c.content,
        c.title,
        c."sectionTitle",
        c."documentType",
        c.language,
        c."sourceType",
        c.metadata,
        1 - (c."${column}" <=> :vector::vector) AS score
      FROM "AiKnowledgeDocumentChunks" c
      WHERE c."companyId" = :companyId
        AND c.enabled = true
        AND c."deletedAt" IS NULL
        AND c."embeddingProvider" = :provider
        AND c."embeddingModel" = :model
        AND c."embeddingDimensions" = :dimensions
        AND c."${column}" IS NOT NULL
    `;

    if (filter.knowledgeBaseIds?.length) {
      sql += ` AND c."knowledgeBaseId" IN (:baseIds)`;
      replacements.baseIds = filter.knowledgeBaseIds;
    }
    if (filter.documentTypes?.length) {
      sql += ` AND c."documentType" IN (:docTypes)`;
      replacements.docTypes = filter.documentTypes;
    }
    if (filter.languages?.length) {
      sql += ` AND c.language IN (:langs)`;
      replacements.langs = filter.languages;
    }
    if (filter.minimumScore != null && Number.isFinite(filter.minimumScore)) {
      sql += ` AND (1 - (c."${column}" <=> :vector::vector)) >= :minScore`;
      replacements.minScore = filter.minimumScore;
    }

    sql += ` ORDER BY c."${column}" <=> :vector::vector ASC LIMIT :limit`;

    try {
      const [rows] = await sequelize.query(sql, { replacements });
      return (rows as Array<Record<string, unknown>>).map(row => ({
        chunkId: Number(row.chunkId),
        knowledgeDocumentId: Number(row.knowledgeDocumentId),
        knowledgeBaseId: Number(row.knowledgeBaseId),
        content: String(row.content || ""),
        title: (row.title as string) || null,
        sectionTitle: (row.sectionTitle as string) || null,
        documentType: (row.documentType as string) || null,
        language: (row.language as string) || null,
        sourceType: (row.sourceType as string) || null,
        metadata: (row.metadata as Record<string, unknown>) || null,
        score: Number(row.score) || 0
      }));
    } catch (err) {
      if (isKnowledgeVectorStoreFallbackAllowed()) {
        logger.warn(
          `[KB] falha na busca pgvector; fallback BYTEA autorizado: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        return this.fallback.searchByEmbedding(queryEmbedding, filter);
      }
      throw new AppError(
        "ERR_KNOWLEDGE_VECTOR_SEARCH_FAILED",
        503,
        "Falha na busca vetorial pgvector. Verifique a extensão, as colunas e as migrations."
      );
    }
  }
}

export default PgVectorStore;
