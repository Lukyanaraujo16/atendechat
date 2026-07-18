import { Op } from "sequelize";
import crypto from "crypto";
import AiAgent from "../../../models/AiAgent";
import AiAgentKnowledgeBase from "../../../models/AiAgentKnowledgeBase";
import AiAgentKnowledgeSettings from "../../../models/AiAgentKnowledgeSettings";
import AiKnowledgeBase from "../../../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentChunk from "../../../models/AiKnowledgeDocumentChunk";
import AiKnowledgeRetrieval from "../../../models/AiKnowledgeRetrieval";
import AppError from "../../../errors/AppError";
import { loadCompanyPlanContextByCompanyId } from "../../../middleware/loadCompanyEffectiveFeatures";
import { AI_AGENT_PLAN_FEATURE_KEY } from "../resolveAiAgentWhatsappFields";
import { KNOWLEDGE_BASE_FEATURE_KEY } from "../../../config/knowledgeBaseConstants";
import {
  AI_AGENT_KNOWLEDGE_DEFAULTS,
  AiAgentKnowledgeChannel
} from "../../../config/aiAgentKnowledgeConstants";
import ResolveKnowledgeEmbeddingSettingsService from "../../KnowledgeBaseService/ResolveKnowledgeEmbeddingSettingsService";
import { EmbeddingProviderFactory } from "../../KnowledgeBaseService/embeddings/EmbeddingProviderFactory";
import { resolveKnowledgeVectorStore } from "../../KnowledgeBaseService/vector";
import { sanitizeProviderError } from "../../KnowledgeBaseService/embeddings/embeddingUtils";
import BuildKnowledgeRetrievalQueryService, {
  hashKnowledgeQuery,
  previewKnowledgeQuery
} from "./BuildKnowledgeRetrievalQueryService";
import { BuildKnowledgeContextService } from "./ApplyKnowledgeContextBudgetService";
import { rankAndLimitKnowledgeHits } from "./rankAndLimitKnowledgeHits";
import type {
  KnowledgeRetrievalHit,
  KnowledgeRetrievalResult
} from "./knowledgeRetrievalTypes";
import ShowAiAgentKnowledgeSettingsService from "./ShowAiAgentKnowledgeSettingsService";

function emptyMetrics(
  provider = "",
  model = "",
  dimensions = 0
): KnowledgeRetrievalResult["metrics"] {
  return {
    durationMs: 0,
    embeddingDurationMs: 0,
    searchDurationMs: 0,
    candidateCount: 0,
    returnedChunkCount: 0,
    returnedDocumentCount: 0,
    estimatedContextTokens: 0,
    contextCharacters: 0,
    provider,
    model,
    dimensions,
    truncated: false
  };
}

function skippedResult(input: {
  reason: string;
  queryUsed?: string;
  allowAnswerWithoutKnowledge?: boolean;
  suggestHandoff?: boolean;
}): KnowledgeRetrievalResult {
  return {
    enabled: false,
    performed: false,
    skippedReason: input.reason,
    status: "skipped",
    queryUsed: input.queryUsed || "",
    results: [],
    contextText: "",
    sources: [],
    metrics: emptyMetrics(),
    knowledgeMissing: true,
    suggestHandoff: Boolean(input.suggestHandoff),
    allowAnswerWithoutKnowledge:
      input.allowAnswerWithoutKnowledge !== undefined
        ? input.allowAnswerWithoutKnowledge
        : true
  };
}

async function persistRetrievalLog(input: {
  companyId: number;
  aiAgentId: number;
  channel: string;
  ticketId?: number | null;
  messageId?: string | null;
  simulationSessionId?: number | null;
  shadowSuggestionId?: number | null;
  requestId?: string | null;
  status: string;
  queryUsed: string;
  knowledgeBaseIds?: number[];
  documentTypes?: string[] | null;
  languages?: string[] | null;
  topK?: number;
  minimumScore?: number;
  metrics: KnowledgeRetrievalResult["metrics"];
  skippedReason?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<number | null> {
  try {
    if (input.requestId) {
      const existing = await AiKnowledgeRetrieval.findOne({
        where: {
          companyId: input.companyId,
          requestId: input.requestId,
          channel: input.channel
        }
      });
      if (existing) return existing.id;
    }

    const meta = input.metadata || null;
    // Limite de metadata (~8KB serializado)
    let safeMeta = meta;
    if (meta) {
      const raw = JSON.stringify(meta);
      if (raw.length > 8000) {
        safeMeta = {
          truncated: true,
          sourceChunkIds: Array.isArray((meta as any).sourceChunkIds)
            ? (meta as any).sourceChunkIds.slice(0, 20)
            : [],
          maxScore: (meta as any).maxScore ?? null
        };
      }
    }

    const row = await AiKnowledgeRetrieval.create({
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      channel: input.channel,
      ticketId: input.ticketId ?? null,
      messageId: input.messageId ?? null,
      simulationSessionId: input.simulationSessionId ?? null,
      shadowSuggestionId: input.shadowSuggestionId ?? null,
      requestId: input.requestId ?? null,
      status: input.status,
      queryHash: input.queryUsed ? hashKnowledgeQuery(input.queryUsed) : null,
      queryPreview: input.queryUsed
        ? previewKnowledgeQuery(input.queryUsed)
        : null,
      knowledgeBaseIds: input.knowledgeBaseIds || null,
      documentTypes: input.documentTypes || null,
      languages: input.languages || null,
      topK: input.topK ?? null,
      minimumScore: input.minimumScore ?? null,
      candidateCount: input.metrics.candidateCount,
      returnedChunkCount: input.metrics.returnedChunkCount,
      returnedDocumentCount: input.metrics.returnedDocumentCount,
      embeddingProvider: input.metrics.provider || null,
      embeddingModel: input.metrics.model || null,
      embeddingDimensions: input.metrics.dimensions || null,
      contextCharacters: input.metrics.contextCharacters,
      estimatedContextTokens: input.metrics.estimatedContextTokens,
      durationMs: input.metrics.durationMs,
      embeddingDurationMs: input.metrics.embeddingDurationMs,
      searchDurationMs: input.metrics.searchDurationMs,
      skippedReason: input.skippedReason || null,
      errorCode: input.errorCode || null,
      errorMessage: input.errorMessage
        ? String(input.errorMessage).slice(0, 500)
        : null,
      metadata: safeMeta
    });
    return row.id;
  } catch (err) {
    // Corrida: unique (company, channel, requestId) — reutiliza existente
    if (input.requestId) {
      try {
        const existing = await AiKnowledgeRetrieval.findOne({
          where: {
            companyId: input.companyId,
            requestId: input.requestId,
            channel: input.channel
          }
        });
        if (existing) return existing.id;
      } catch {
        // ignore
      }
    }
    return null;
  }
}

/**
 * KnowledgeRetrievalEngine — recupera contexto para o Agente.
 * Não gera resposta. Fail-open controlado pelo caller (Sim/Shadow/Live).
 */
export default async function RetrieveKnowledgeForAgentService(input: {
  companyId: number;
  aiAgentId: number;
  query: string;
  channel: AiAgentKnowledgeChannel;
  conversationContext?: Array<{ role?: string; content?: string }>;
  language?: string | null;
  documentTypes?: string[] | null;
  topK?: number;
  minimumScore?: number;
  requestId?: string | null;
  ticketId?: number | null;
  messageId?: string | null;
  simulationSessionId?: number | null;
  shadowSuggestionId?: number | null;
  /** Endpoint de teste / forçar canal ignorando flags de canal (ainda exige enabled). */
  forceEnabled?: boolean;
  skipPersist?: boolean;
}): Promise<KnowledgeRetrievalResult> {
  const startedAt = Date.now();
  const channel = input.channel;

  const agent = await AiAgent.findOne({
    where: { id: input.aiAgentId, companyId: input.companyId }
  });
  if (!agent) {
    throw new AppError("ERR_NO_AI_AGENT_FOUND", 404, "Agente não encontrado.");
  }

  const planCtx = await loadCompanyPlanContextByCompanyId(input.companyId);
  const hasAgent = planCtx?.featureMap[AI_AGENT_PLAN_FEATURE_KEY] === true;
  const hasKb = planCtx?.featureMap[KNOWLEDGE_BASE_FEATURE_KEY] === true;
  if (!hasAgent || !hasKb) {
    const result = skippedResult({ reason: "feature_blocked" });
    result.metrics.durationMs = Date.now() - startedAt;
    return result;
  }

  const settings = await ShowAiAgentKnowledgeSettingsService({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId
  });

  const channelEnabled =
    channel === "test" ||
    input.forceEnabled ||
    (channel === "simulator" && settings.enabledInSimulator) ||
    (channel === "shadow" && settings.enabledInShadow) ||
    (channel === "live" && settings.enabledInLive);

  if (!settings.enabled && channel !== "test" && !input.forceEnabled) {
    const result = skippedResult({
      reason: "disabled",
      allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge,
      suggestHandoff: false
    });
    result.metrics.durationMs = Date.now() - startedAt;
    if (!input.skipPersist) {
      result.retrievalId = await persistRetrievalLog({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel,
        ticketId: input.ticketId,
        messageId: input.messageId,
        simulationSessionId: input.simulationSessionId,
        shadowSuggestionId: input.shadowSuggestionId,
        requestId: input.requestId,
        status: "skipped",
        queryUsed: "",
        metrics: result.metrics,
        skippedReason: "disabled"
      });
    }
    return result;
  }

  if (!channelEnabled) {
    const result = skippedResult({
      reason: "channel_disabled",
      allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge,
      suggestHandoff: false
    });
    result.enabled = settings.enabled;
    result.metrics.durationMs = Date.now() - startedAt;
    if (!input.skipPersist) {
      result.retrievalId = await persistRetrievalLog({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel,
        ticketId: input.ticketId,
        messageId: input.messageId,
        simulationSessionId: input.simulationSessionId,
        shadowSuggestionId: input.shadowSuggestionId,
        requestId: input.requestId,
        status: "skipped",
        queryUsed: "",
        metrics: result.metrics,
        skippedReason: "channel_disabled"
      });
    }
    return result;
  }

  // Idempotência: reutiliza log existente sem novo embedding (Shadow/Live).
  // Simulador/test usam requestId único por execução manual.
  if (input.requestId && channel !== "test" && !input.forceEnabled) {
    const existing = await AiKnowledgeRetrieval.findOne({
      where: {
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel,
        requestId: input.requestId
      }
    });
    if (existing) {
      const reused: KnowledgeRetrievalResult = {
        enabled: true,
        performed: existing.status !== "skipped",
        skippedReason: existing.skippedReason,
        status: existing.status as KnowledgeRetrievalResult["status"],
        queryUsed: existing.queryPreview || "",
        results: [],
        contextText: "",
        sources: [],
        metrics: {
          durationMs: existing.durationMs,
          embeddingDurationMs: existing.embeddingDurationMs,
          searchDurationMs: existing.searchDurationMs,
          candidateCount: existing.candidateCount,
          returnedChunkCount: existing.returnedChunkCount,
          returnedDocumentCount: existing.returnedDocumentCount,
          estimatedContextTokens: existing.estimatedContextTokens,
          contextCharacters: existing.contextCharacters,
          provider: existing.embeddingProvider || "",
          model: existing.embeddingModel || "",
          dimensions: existing.embeddingDimensions || 0,
          truncated: false
        },
        errorCode: existing.errorCode,
        errorMessage: existing.errorMessage,
        knowledgeMissing: (existing.returnedChunkCount || 0) === 0,
        suggestHandoff:
          (existing.returnedChunkCount || 0) === 0 &&
          settings.handoffWhenKnowledgeMissing,
        allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge,
        retrievalId: existing.id
      };
      return reused;
    }
  }

  const queryUsed = BuildKnowledgeRetrievalQueryService({
    currentMessage: input.query,
    recentMessages: input.conversationContext
  });

  if (!queryUsed) {
    const result = skippedResult({
      reason: "empty_query",
      allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge,
      suggestHandoff: settings.handoffWhenKnowledgeMissing
    });
    result.enabled = true;
    result.metrics.durationMs = Date.now() - startedAt;
    return result;
  }

  const links = await AiAgentKnowledgeBase.findAll({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      enabled: true
    },
    include: [
      {
        model: AiKnowledgeBase,
        required: true,
        where: { companyId: input.companyId, enabled: true }
      }
    ],
    order: [
      ["priority", "ASC"],
      ["id", "ASC"]
    ]
  });

  if (!links.length) {
    const result = skippedResult({
      reason: "no_linked_bases",
      queryUsed,
      allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge,
      suggestHandoff: settings.handoffWhenKnowledgeMissing
    });
    result.enabled = true;
    result.metrics.durationMs = Date.now() - startedAt;
    if (!input.skipPersist) {
      result.retrievalId = await persistRetrievalLog({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel,
        ticketId: input.ticketId,
        messageId: input.messageId,
        simulationSessionId: input.simulationSessionId,
        shadowSuggestionId: input.shadowSuggestionId,
        requestId: input.requestId,
        status: "skipped",
        queryUsed,
        metrics: result.metrics,
        skippedReason: "no_linked_bases"
      });
    }
    return result;
  }

  const baseIds = links.map(l => l.knowledgeBaseId);
  const priorityByBase = new Map(links.map(l => [l.knowledgeBaseId, l.priority]));
  const baseNameById = new Map(
    links.map(l => [
      l.knowledgeBaseId,
      (l.knowledgeBase as AiKnowledgeBase)?.name || null
    ])
  );

  let resolved;
  try {
    resolved = await ResolveKnowledgeEmbeddingSettingsService({
      companyId: input.companyId
    });
  } catch (err) {
    const code =
      err instanceof AppError ? err.message : "missing_embedding_settings";
    const result: KnowledgeRetrievalResult = {
      enabled: true,
      performed: false,
      skippedReason:
        code === "ERR_KNOWLEDGE_EMBEDDING_CREDENTIAL"
          ? "invalid_credential"
          : "missing_embedding_settings",
      status: "failed",
      queryUsed,
      results: [],
      contextText: "",
      sources: [],
      metrics: emptyMetrics(),
      errorCode: code,
      errorMessage:
        err instanceof AppError
          ? err.clientMessage || err.message
          : "Configuração de embeddings indisponível.",
      knowledgeMissing: true,
      suggestHandoff: settings.handoffWhenKnowledgeMissing,
      allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge
    };
    result.metrics.durationMs = Date.now() - startedAt;
    if (!input.skipPersist) {
      result.retrievalId = await persistRetrievalLog({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel,
        ticketId: input.ticketId,
        messageId: input.messageId,
        simulationSessionId: input.simulationSessionId,
        shadowSuggestionId: input.shadowSuggestionId,
        requestId: input.requestId,
        status: "failed",
        queryUsed,
        knowledgeBaseIds: baseIds,
        metrics: result.metrics,
        skippedReason: result.skippedReason,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
      });
    }
    return result;
  }

  const topK = Math.min(
    20,
    Math.max(1, Number(input.topK ?? settings.topK) || AI_AGENT_KNOWLEDGE_DEFAULTS.topK)
  );
  const minimumScore =
    input.minimumScore != null && Number.isFinite(Number(input.minimumScore))
      ? Number(input.minimumScore)
      : Number(settings.minimumScore);

  const docTypes =
    input.documentTypes?.length
      ? input.documentTypes
      : Array.isArray(settings.documentTypes) && settings.documentTypes.length
        ? settings.documentTypes
        : undefined;
  const languages =
    input.language
      ? [input.language]
      : Array.isArray(settings.languages) && settings.languages.length
        ? settings.languages
        : undefined;

  let embeddingDurationMs = 0;
  let searchDurationMs = 0;
  let queryEmbedding: number[];

  try {
    const embStarted = Date.now();
    const embProvider = EmbeddingProviderFactory(resolved.provider);
    queryEmbedding = await embProvider.generateEmbedding({
      apiKey: resolved.apiKey,
      model: resolved.model,
      text: queryUsed
    });
    embeddingDurationMs = Date.now() - embStarted;
  } catch (err) {
    const sanitized = sanitizeProviderError(err);
    const result: KnowledgeRetrievalResult = {
      enabled: true,
      performed: true,
      skippedReason: null,
      status: "failed",
      queryUsed,
      results: [],
      contextText: "",
      sources: [],
      metrics: {
        ...emptyMetrics(resolved.provider, resolved.model, resolved.dimensions),
        durationMs: Date.now() - startedAt,
        embeddingDurationMs: Date.now() - startedAt
      },
      errorCode: sanitized.code,
      errorMessage: sanitized.message,
      knowledgeMissing: true,
      suggestHandoff: settings.handoffWhenKnowledgeMissing,
      allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge
    };
    if (!input.skipPersist) {
      result.retrievalId = await persistRetrievalLog({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel,
        ticketId: input.ticketId,
        messageId: input.messageId,
        simulationSessionId: input.simulationSessionId,
        shadowSuggestionId: input.shadowSuggestionId,
        requestId: input.requestId,
        status: "failed",
        queryUsed,
        knowledgeBaseIds: baseIds,
        topK,
        minimumScore,
        metrics: result.metrics,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
      });
    }
    return result;
  }

  let hitsRaw;
  try {
    const searchStarted = Date.now();
    const store = resolveKnowledgeVectorStore();
    hitsRaw = await store.searchByEmbedding(queryEmbedding, {
      companyId: input.companyId,
      knowledgeBaseIds: baseIds,
      documentTypes: docTypes,
      languages,
      embeddingProvider: resolved.provider,
      embeddingModel: resolved.model,
      embeddingDimensions: resolved.dimensions,
      limit: Math.min(50, topK * 4),
      minimumScore
    });
    searchDurationMs = Date.now() - searchStarted;
  } catch (err) {
    const sanitized = sanitizeProviderError(err);
    const result: KnowledgeRetrievalResult = {
      enabled: true,
      performed: true,
      skippedReason: null,
      status: "failed",
      queryUsed,
      results: [],
      contextText: "",
      sources: [],
      metrics: {
        ...emptyMetrics(resolved.provider, resolved.model, resolved.dimensions),
        durationMs: Date.now() - startedAt,
        embeddingDurationMs,
        searchDurationMs: Date.now() - startedAt - embeddingDurationMs
      },
      errorCode: sanitized.code || "ERR_KNOWLEDGE_VECTOR_SEARCH_FAILED",
      errorMessage: sanitized.message,
      knowledgeMissing: true,
      suggestHandoff: settings.handoffWhenKnowledgeMissing,
      allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge
    };
    if (!input.skipPersist) {
      result.retrievalId = await persistRetrievalLog({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel,
        ticketId: input.ticketId,
        messageId: input.messageId,
        simulationSessionId: input.simulationSessionId,
        shadowSuggestionId: input.shadowSuggestionId,
        requestId: input.requestId,
        status: "failed",
        queryUsed,
        knowledgeBaseIds: baseIds,
        topK,
        minimumScore,
        metrics: result.metrics,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
      });
    }
    return result;
  }

  // Filtrar documentos: somente indexStatus completed + indexing ativo vigente.
  // outdated/failed/pending nunca entram. Chunks devem pertencer ao activeIndexingId.
  const docIds = [...new Set(hitsRaw.map(h => h.knowledgeDocumentId))] as number[];
  const eligibleDocs = docIds.length
    ? await AiKnowledgeDocument.findAll({
        where: {
          companyId: input.companyId,
          id: { [Op.in]: docIds },
          indexStatus: "completed",
          activeIndexingId: { [Op.ne]: null }
        },
        attributes: [
          "id",
          "title",
          "sourceUrl",
          "sourceType",
          "documentType",
          "language",
          "activeIndexingId",
          "lastIndexedChecksum",
          "checksum"
        ]
      })
    : [];
  const eligibleDocIds = new Set(eligibleDocs.map(d => d.id));
  const docMap = new Map(eligibleDocs.map(d => [d.id, d]));
  const activeIndexingByDoc = new Map(
    eligibleDocs.map(d => [d.id, d.activeIndexingId as number])
  );

  // Chunks ativos da versão de índice vigente
  const chunkIds = hitsRaw.map(h => h.chunkId) as number[];
  const chunks = chunkIds.length
    ? await AiKnowledgeDocumentChunk.findAll({
        where: {
          companyId: input.companyId,
          id: { [Op.in]: chunkIds },
          enabled: true
        },
        attributes: [
          "id",
          "chunkHash",
          "enabled",
          "indexingId",
          "knowledgeDocumentId"
        ]
      })
    : [];
  const activeChunks = chunks.filter(c => {
    const activeIdx = activeIndexingByDoc.get(c.knowledgeDocumentId);
    return activeIdx != null && c.indexingId === activeIdx;
  });
  const activeChunkIds = new Set(activeChunks.map(c => c.id));
  const hashByChunk = new Map(activeChunks.map(c => [c.id, c.chunkHash]));

  const mapped: KnowledgeRetrievalHit[] = hitsRaw
    .filter(
      h =>
        eligibleDocIds.has(h.knowledgeDocumentId) &&
        activeChunkIds.has(h.chunkId) &&
        baseIds.includes(h.knowledgeBaseId)
    )
    .map(h => {
      const doc = docMap.get(h.knowledgeDocumentId);
      return {
        knowledgeBaseId: h.knowledgeBaseId,
        knowledgeBaseName: baseNameById.get(h.knowledgeBaseId) || null,
        documentId: h.knowledgeDocumentId,
        documentTitle: doc?.title || h.title,
        documentType: h.documentType || doc?.documentType || null,
        chunkId: h.chunkId,
        chunkHash: hashByChunk.get(h.chunkId) || null,
        sectionTitle: h.sectionTitle,
        content: h.content,
        similarityScore: Number(h.score) || 0,
        sourceType: h.sourceType || doc?.sourceType || null,
        sourceUrl: doc?.sourceUrl || null,
        language: h.language || doc?.language || null,
        priority: priorityByBase.get(h.knowledgeBaseId) ?? 100,
        metadata: null
      };
    });

  const ranked = rankAndLimitKnowledgeHits({
    hits: mapped,
    topK,
    maxChunksPerDocument: settings.maxChunksPerDocument,
    maxChunksPerBase: settings.maxChunksPerBase
  });

  const budget = BuildKnowledgeContextService({
    hits: ranked,
    maxContextCharacters: settings.maxContextCharacters,
    maxContextTokens: settings.maxContextTokens
  });

  const sources = budget.selected.map(h => ({
    knowledgeBaseId: h.knowledgeBaseId,
    knowledgeBaseName: h.knowledgeBaseName,
    documentId: h.documentId,
    documentTitle: h.documentTitle,
    documentType: h.documentType,
    chunkId: h.chunkId,
    sectionTitle: h.sectionTitle,
    similarityScore: h.similarityScore,
    sourceType: h.sourceType,
    sourceUrl: h.sourceUrl,
    language: h.language,
    priority: h.priority
  }));

  const knowledgeMissing = budget.selected.length === 0;
  const status = knowledgeMissing ? "empty" : "completed";
  const metrics = {
    durationMs: Date.now() - startedAt,
    embeddingDurationMs,
    searchDurationMs,
    candidateCount: hitsRaw.length,
    returnedChunkCount: budget.selected.length,
    returnedDocumentCount: new Set(budget.selected.map(h => h.documentId)).size,
    estimatedContextTokens: budget.estimatedContextTokens,
    contextCharacters: budget.contextCharacters,
    provider: resolved.provider,
    model: resolved.model,
    dimensions: resolved.dimensions,
    truncated: budget.truncated
  };

  const result: KnowledgeRetrievalResult = {
    enabled: true,
    performed: true,
    skippedReason: null,
    status,
    queryUsed,
    results: budget.selected,
    contextText: budget.contextText,
    sources: settings.includeSourcesInInternalMetadata ? sources : [],
    metrics,
    knowledgeMissing,
    suggestHandoff:
      knowledgeMissing && settings.handoffWhenKnowledgeMissing,
    allowAnswerWithoutKnowledge: settings.allowAnswerWithoutKnowledge
  };

  if (!input.skipPersist) {
    result.retrievalId = await persistRetrievalLog({
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      channel,
      ticketId: input.ticketId,
      messageId: input.messageId,
      simulationSessionId: input.simulationSessionId,
      shadowSuggestionId: input.shadowSuggestionId,
      requestId: input.requestId,
      status,
      queryUsed,
      knowledgeBaseIds: baseIds,
      documentTypes: docTypes || null,
      languages: languages || null,
      topK,
      minimumScore,
      metrics,
      metadata: settings.includeSourcesInInternalMetadata
        ? {
            sourceChunkIds: sources.map(s => s.chunkId),
            maxScore: sources[0]?.similarityScore ?? null,
            requestNonce: crypto.randomBytes(4).toString("hex")
          }
        : { maxScore: sources[0]?.similarityScore ?? null }
    });
  }

  return result;
}
