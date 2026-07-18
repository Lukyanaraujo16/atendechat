import { Op } from "sequelize";
import AiKnowledgeDocumentChunk from "../../../models/AiKnowledgeDocumentChunk";
import {
  KNOWLEDGE_SEARCH_CANDIDATE_LIMIT
} from "../../../config/knowledgeBaseConstants";
import {
  bufferToFloat32Array,
  cosineSimilarity
} from "../embeddings/embeddingUtils";
import type {
  KnowledgeVectorStore,
  VectorSearchFilter,
  VectorSearchHit
} from "./types";

/**
 * Vector store de produção para volumes moderados.
 * Pré-filtra no SQL (tenant, bases, provider/modelo/dimensão, enabled)
 * e calcula cosine apenas nos candidatos — NÃO carrega a tabela inteira.
 *
 * Identificado explicitamente como `bytea_cosine_filtered`.
 * Para escala maior, preferir `pgvector` no deploy (KNOWLEDGE_VECTOR_STORE=pgvector).
 */
export class ByteaCosineVectorStore implements KnowledgeVectorStore {
  readonly kind = "bytea_cosine_filtered" as const;

  assertSupportsDimensions(_dimensions: number): void {
    // BYTEA aceita qualquer dimensão registada no catálogo
  }

  async searchByEmbedding(
    queryEmbedding: number[],
    filter: VectorSearchFilter
  ): Promise<VectorSearchHit[]> {
    const candidateLimit = Math.min(
      filter.candidateLimit || KNOWLEDGE_SEARCH_CANDIDATE_LIMIT,
      KNOWLEDGE_SEARCH_CANDIDATE_LIMIT
    );
    const where: Record<string, unknown> = {
      companyId: filter.companyId,
      enabled: true,
      embeddingProvider: filter.embeddingProvider,
      embeddingModel: filter.embeddingModel,
      embeddingDimensions: filter.embeddingDimensions,
      embedding: { [Op.ne]: null }
    };
    if (filter.knowledgeBaseIds?.length) {
      where.knowledgeBaseId = { [Op.in]: filter.knowledgeBaseIds };
    }
    if (filter.documentTypes?.length) {
      where.documentType = { [Op.in]: filter.documentTypes };
    }
    if (filter.languages?.length) {
      where.language = { [Op.in]: filter.languages };
    }

    const rows = await AiKnowledgeDocumentChunk.findAll({
      where,
      attributes: [
        "id",
        "knowledgeDocumentId",
        "knowledgeBaseId",
        "content",
        "title",
        "sectionTitle",
        "documentType",
        "language",
        "sourceType",
        "metadata",
        "embedding"
      ],
      limit: candidateLimit,
      order: [["id", "ASC"]]
    });

    const scored: VectorSearchHit[] = [];
    for (const row of rows) {
      if (!row.embedding) continue;
      const vec = bufferToFloat32Array(
        Buffer.isBuffer(row.embedding)
          ? row.embedding
          : Buffer.from(row.embedding as unknown as ArrayBuffer)
      );
      // Nunca comparar vetores de dimensões diferentes.
      if (vec.length !== filter.embeddingDimensions) continue;
      if (queryEmbedding.length !== filter.embeddingDimensions) {
        return [];
      }
      const score = cosineSimilarity(queryEmbedding, vec);
      if (
        filter.minimumScore != null &&
        Number.isFinite(filter.minimumScore) &&
        score < filter.minimumScore
      ) {
        continue;
      }
      scored.push({
        chunkId: row.id,
        knowledgeDocumentId: row.knowledgeDocumentId,
        knowledgeBaseId: row.knowledgeBaseId,
        content: row.content,
        title: row.title,
        sectionTitle: row.sectionTitle,
        documentType: row.documentType,
        language: row.language,
        sourceType: row.sourceType,
        metadata: row.metadata,
        score
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(1, filter.limit));
  }
}

export default ByteaCosineVectorStore;
