import { Job } from "bull";
import sequelize from "../../database";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentIndexing from "../../models/AiKnowledgeDocumentIndexing";
import AiKnowledgeDocumentChunk from "../../models/AiKnowledgeDocumentChunk";
import {
  KNOWLEDGE_INDEXING_TIMEOUT_MS
} from "../../config/knowledgeBaseConstants";
import type { KnowledgeDocumentIndexJobData } from "../../libs/knowledgeDocumentIndexQueue";
import ResolveKnowledgeEmbeddingSettingsService from "./ResolveKnowledgeEmbeddingSettingsService";
import KnowledgeChunkBuilder from "./chunking/KnowledgeChunkBuilder";
import { EmbeddingProviderFactory } from "./embeddings/EmbeddingProviderFactory";
import { float32ArrayToBuffer } from "./embeddings/embeddingUtils";
import {
  assertEmbeddingLengthMatchesDimensions
} from "../../config/knowledgeEmbeddingModels";
import { assertVectorStoreReadyForModel } from "./vector";

function appendLog(
  logs: Record<string, unknown>[] | null | undefined,
  entry: Record<string, unknown>
): Record<string, unknown>[] {
  return [...(logs || []), { ...entry, at: new Date().toISOString() }];
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new AppError("ERR_KNOWLEDGE_INDEX_TIMEOUT", 408, message)
          );
        }, ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errParts(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) {
    return {
      code: err.message,
      message: err.clientMessage || err.message
    };
  }
  if (err instanceof Error) {
    return { code: "ERR_KNOWLEDGE_INDEX_FAILED", message: err.message.slice(0, 500) };
  }
  return { code: "ERR_KNOWLEDGE_INDEX_FAILED", message: "Falha na indexação." };
}

/**
 * Worker: chunking → embeddings em batch → armazena versão inativa → ativa atomicamente.
 * Em falha, mantém a versão ativa anterior.
 */
export async function processKnowledgeDocumentIndexJob(
  job: Job<KnowledgeDocumentIndexJobData>
): Promise<{ ok: boolean; indexingId: number }> {
  const { companyId, knowledgeDocumentId, indexingId } = job.data;
  const startedAt = new Date();

  const indexing = await AiKnowledgeDocumentIndexing.findOne({
    where: { id: indexingId, companyId, knowledgeDocumentId }
  });
  const document = await AiKnowledgeDocument.findOne({
    where: { id: knowledgeDocumentId, companyId }
  });

  if (!indexing || !document) {
    logger.warn(
      `[KB-Index] Job ${job.id}: indexing/document não encontrado`
    );
    return { ok: false, indexingId };
  }

  await indexing.update({
    status: "chunking",
    startedAt,
    logs: appendLog(indexing.logs, { event: "chunking_started" })
  });
  await document.update({ indexStatus: "indexing" });

  try {
    const resolved = await ResolveKnowledgeEmbeddingSettingsService({
      companyId
    });
    // Validar VectorStore no início do job (evita indexing eterno / config aceita no API e falha só no worker).
    const storePlan = await assertVectorStoreReadyForModel({
      provider: resolved.provider,
      model: resolved.model
    });
    const contentText = String(document.contentText || "").trim();
    if (!contentText) {
      throw new AppError(
        "ERR_KNOWLEDGE_INDEX_EMPTY_CONTENT",
        400,
        "contentText vazio."
      );
    }

    const built = KnowledgeChunkBuilder({
      contentText,
      title: document.title,
      documentType: document.documentType,
      language: document.language,
      sourceType: document.sourceType,
      sourceUrl: document.sourceUrl,
      knowledgeBaseId: document.knowledgeBaseId,
      knowledgeDocumentId: document.id,
      chunkSize: resolved.settings.chunkSize,
      chunkOverlap: resolved.settings.chunkOverlap,
      minChunkSize: resolved.settings.minChunkSize
    });

    if (!built.length) {
      throw new AppError(
        "ERR_KNOWLEDGE_INDEX_NO_CHUNKS",
        422,
        "Nenhum chunk gerado a partir do conteúdo."
      );
    }

    await indexing.update({
      status: "embedding",
      chunksGenerated: built.length,
      charactersProcessed: contentText.length,
      tokensEstimated: built.reduce((a, c) => a + (c.tokenCount || 0), 0),
      logs: appendLog(indexing.logs, {
        event: "chunks_built",
        count: built.length
      })
    });

    const embProvider = EmbeddingProviderFactory(resolved.provider);
    const batchSize = Math.max(1, resolved.settings.batchSize || 16);
    const vectors: number[][] = [];
    let calls = 0;
    let tokensEstimated = 0;
    let tokensExact = 0;

    await withTimeout(
      (async () => {
        for (let i = 0; i < built.length; i += batchSize) {
          const batch = built.slice(i, i + batchSize);
          const result = await embProvider.generateEmbeddings({
            apiKey: resolved.apiKey,
            model: resolved.model,
            texts: batch.map(c => c.content)
          });
          vectors.push(...result.embeddings);
          calls += result.calls;
          tokensEstimated += result.tokensEstimated || 0;
          tokensExact += result.tokensExact || 0;
          await indexing.update({
            chunksEmbedded: vectors.length,
            logs: appendLog(indexing.logs, {
              event: "batch_embedded",
              from: i,
              to: i + batch.length - 1,
              calls: result.calls
            })
          });
        }
      })(),
      KNOWLEDGE_INDEXING_TIMEOUT_MS,
      "Tempo limite de indexação excedido."
    );

    if (vectors.length !== built.length) {
      throw new AppError(
        "ERR_KNOWLEDGE_EMBEDDING_PARTIAL",
        502,
        "Quantidade de embeddings diferente dos chunks."
      );
    }

    await indexing.update({
      status: "storing",
      chunksEmbedded: vectors.length,
      tokensEstimated: tokensExact || tokensEstimated,
      logs: appendLog(indexing.logs, {
        event: "storing",
        embeddingCalls: calls
      })
    });

    // Persistir chunks da NOVA versão (enabled=false) e ativar atomicamente
    await sequelize.transaction(async transaction => {
      const createdIds: number[] = [];

      for (let i = 0; i < built.length; i += 1) {
        const chunk = built[i];
        const emb = vectors[i];
        assertEmbeddingLengthMatchesDimensions(emb, resolved.dimensions);
        if (emb.length !== resolved.dimensions) {
          throw new AppError(
            "ERR_KNOWLEDGE_EMBEDDING_DIMENSION",
            502,
            "Dimensão incompatível ao armazenar chunk."
          );
        }
        const row = await AiKnowledgeDocumentChunk.create(
          {
            companyId,
            knowledgeBaseId: document.knowledgeBaseId,
            knowledgeDocumentId: document.id,
            indexingId: indexing.id,
            chunkIndex: chunk.chunkIndex,
            chunkHash: chunk.chunkHash,
            content: chunk.content,
            characterStart: chunk.characterStart,
            characterEnd: chunk.characterEnd,
            tokenCount: chunk.tokenCount,
            tokenCountEstimated: true,
            documentType: chunk.documentType,
            language: chunk.language,
            sourceType: chunk.sourceType,
            title: chunk.title,
            sectionTitle: chunk.sectionTitle,
            metadata: chunk.metadata,
            embeddingProvider: resolved.provider,
            embeddingModel: resolved.model,
            embeddingDimensions: resolved.dimensions,
            embeddingVersion: resolved.embeddingVersion,
            embedding: float32ArrayToBuffer(emb),
            enabled: false
          },
          { transaction }
        );
        createdIds.push(row.id);
      }

      // Desativar chunks da versão ativa anterior
      const previousActive = await AiKnowledgeDocumentIndexing.findAll({
        where: {
          companyId,
          knowledgeDocumentId: document.id,
          isActive: true
        },
        transaction
      });

      for (const prev of previousActive) {
        await AiKnowledgeDocumentChunk.update(
          { enabled: false },
          {
            where: {
              companyId,
              knowledgeDocumentId: document.id,
              indexingId: prev.id
            },
            transaction
          }
        );
        await prev.update({ isActive: false }, { transaction });
      }

      // Ativar nova versão
      await AiKnowledgeDocumentChunk.update(
        { enabled: true },
        {
          where: {
            companyId,
            indexingId: indexing.id,
            id: createdIds
          },
          transaction
        }
      );

      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      await indexing.update(
        {
          status: "completed",
          isActive: true,
          finishedAt,
          durationMs,
          errorCode: null,
          errorMessage: null,
          logs: appendLog(indexing.logs, {
            event: "completed",
            chunks: built.length,
            durationMs,
            embeddingCalls: calls
          })
        },
        { transaction }
      );

      await document.update(
        {
          indexStatus: "completed",
          lastIndexedAt: finishedAt,
          lastIndexingError: null,
          lastIndexedChecksum: indexing.contentHash,
          lastIndexingDurationMs: durationMs,
          lastEmbeddingProvider: resolved.provider,
          lastEmbeddingModel: resolved.model,
          lastEmbeddingDimensions: resolved.dimensions,
          lastChunkingVersion: indexing.chunkingVersion,
          chunkCount: built.length,
          activeIndexingId: indexing.id
        },
        { transaction }
      );
    });

    // Sync coluna pgvector tipada por dimensão (além do BYTEA canónico).
    // Com fallback explícito, BYTEA já é a representação — não tentar pgvector.
    if (
      !storePlan.usingFallback &&
      storePlan.store.persistEmbedding
    ) {
      const enabledChunks = await AiKnowledgeDocumentChunk.findAll({
        where: { companyId, indexingId: indexing.id, enabled: true },
        attributes: ["id", "embedding"]
      });
      const { bufferToFloat32Array } = await import(
        "./embeddings/embeddingUtils"
      );
      for (const ch of enabledChunks) {
        if (!ch.embedding) continue;
        const vec = bufferToFloat32Array(
          Buffer.isBuffer(ch.embedding)
            ? ch.embedding
            : Buffer.from(ch.embedding as unknown as ArrayBuffer)
        );
        await storePlan.store.persistEmbedding({
          chunkId: ch.id,
          embedding: vec,
          dimensions: resolved.dimensions
        });
      }
    }

    return { ok: true, indexingId };
  } catch (err) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const { code, message } = errParts(err);

    logger.error(
      `[KB-Index] Falha doc=${knowledgeDocumentId}: ${code} ${message}`
    );

    // Remover chunks incompletos desta tentativa (não tocamos na versão ativa)
    await AiKnowledgeDocumentChunk.destroy({
      where: {
        companyId,
        indexingId: indexing.id,
        enabled: false
      },
      force: true
    });

    await indexing.update({
      status: "failed",
      finishedAt,
      durationMs,
      errorCode: code,
      errorMessage: message,
      isActive: false,
      logs: appendLog(indexing.logs, {
        event: "failed",
        code,
        // sem conteúdo de chunks
        message
      })
    });

    // Se havia índice ativo anterior, documento fica failed na tentativa mas
    // o índice anterior permanece enabled — marcar failed na tentativa atual.
    const stillActive = await AiKnowledgeDocumentIndexing.findOne({
      where: {
        companyId,
        knowledgeDocumentId: document.id,
        isActive: true,
        status: "completed"
      }
    });

    await document.update({
      indexStatus: stillActive ? "outdated" : "failed",
      lastIndexingError: message,
      lastIndexingDurationMs: durationMs
    });

    // Retry só para erros transitórios
    if (
      err instanceof AppError &&
      (err.message === "ERR_KNOWLEDGE_EMBEDDING_TRANSIENT" ||
        err.statusCode === 429)
    ) {
      throw err;
    }

    return { ok: false, indexingId };
  }
}

export default processKnowledgeDocumentIndexJob;
