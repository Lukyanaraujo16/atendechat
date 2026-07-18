import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import AiKnowledgeBase from "../../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import ResolveKnowledgeEmbeddingSettingsService from "./ResolveKnowledgeEmbeddingSettingsService";
import { EmbeddingProviderFactory } from "./embeddings/EmbeddingProviderFactory";
import { resolveKnowledgeVectorStore } from "./vector";

export type KnowledgeSearchResult = {
  chunkId: number;
  documentId: number;
  knowledgeBaseId: number;
  documentTitle: string | null;
  documentType: string | null;
  sectionTitle: string | null;
  chunkContent: string;
  similarityScore: number;
  sourceType: string | null;
  sourceUrl: string | null;
  language: string | null;
  knowledgeBaseName: string | null;
};

/**
 * Busca semântica ADMINISTRATIVA — não usada pelo runtime do Agente (1.5.2D).
 */
export default async function SearchKnowledgeChunksService(input: {
  companyId: number;
  query: string;
  knowledgeBaseIds?: number[];
  documentTypes?: string[];
  languages?: string[];
  limit?: number;
  minimumScore?: number;
}): Promise<{
  results: KnowledgeSearchResult[];
  meta: {
    provider: string;
    model: string;
    dimensions: number;
    vectorStore: string;
    query: string;
  };
}> {
  const query = String(input.query || "").trim();
  if (!query) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "query é obrigatória.");
  }
  if (query.length > 2000) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "query demasiado longa."
    );
  }

  let baseIds = input.knowledgeBaseIds?.filter(id => Number.isFinite(id));
  if (baseIds?.length) {
    const owned = await AiKnowledgeBase.findAll({
      where: {
        companyId: input.companyId,
        id: { [Op.in]: baseIds },
        enabled: true
      },
      attributes: ["id", "name"]
    });
    if (owned.length !== baseIds.length) {
      throw new AppError(
        "ERR_KNOWLEDGE_BASE_NOT_FOUND",
        404,
        "Uma ou mais bases são inválidas ou inacessíveis."
      );
    }
  } else {
    const all = await AiKnowledgeBase.findAll({
      where: { companyId: input.companyId, enabled: true },
      attributes: ["id"]
    });
    baseIds = all.map(b => b.id);
  }

  if (!baseIds.length) {
    return {
      results: [],
      meta: {
        provider: "",
        model: "",
        dimensions: 0,
        vectorStore: resolveKnowledgeVectorStore().kind,
        query
      }
    };
  }

  const resolved = await ResolveKnowledgeEmbeddingSettingsService({
    companyId: input.companyId
  });
  const embProvider = EmbeddingProviderFactory(resolved.provider);
  const queryEmbedding = await embProvider.generateEmbedding({
    apiKey: resolved.apiKey,
    model: resolved.model,
    text: query
  });

  const store = resolveKnowledgeVectorStore();
  const hits = await store.searchByEmbedding(queryEmbedding, {
    companyId: input.companyId,
    knowledgeBaseIds: baseIds,
    documentTypes: input.documentTypes,
    languages: input.languages,
    embeddingProvider: resolved.provider,
    embeddingModel: resolved.model,
    embeddingDimensions: resolved.dimensions,
    limit: Math.min(50, Math.max(1, Number(input.limit) || 8)),
    minimumScore:
      input.minimumScore != null && Number.isFinite(Number(input.minimumScore))
        ? Number(input.minimumScore)
        : undefined
  });

  const docIds = [...new Set(hits.map(h => h.knowledgeDocumentId))];
  const docs = docIds.length
    ? await AiKnowledgeDocument.findAll({
        where: { companyId: input.companyId, id: { [Op.in]: docIds } },
        attributes: ["id", "title", "sourceUrl", "sourceType"]
      })
    : [];
  const docMap = new Map(docs.map(d => [d.id, d]));

  const bases = await AiKnowledgeBase.findAll({
    where: { companyId: input.companyId, id: { [Op.in]: baseIds } },
    attributes: ["id", "name"]
  });
  const baseMap = new Map(bases.map(b => [b.id, b.name]));

  const results: KnowledgeSearchResult[] = hits.map(h => {
    const doc = docMap.get(h.knowledgeDocumentId);
    return {
      chunkId: h.chunkId,
      documentId: h.knowledgeDocumentId,
      knowledgeBaseId: h.knowledgeBaseId,
      documentTitle: doc?.title || h.title,
      documentType: h.documentType,
      sectionTitle: h.sectionTitle,
      chunkContent: h.content,
      similarityScore: Number(h.score.toFixed(6)),
      sourceType: h.sourceType || doc?.sourceType || null,
      sourceUrl: doc?.sourceUrl || null,
      language: h.language,
      knowledgeBaseName: baseMap.get(h.knowledgeBaseId) || null
    };
  });

  return {
    results,
    meta: {
      provider: resolved.provider,
      model: resolved.model,
      dimensions: resolved.dimensions,
      vectorStore: store.kind,
      query
    }
  };
}
