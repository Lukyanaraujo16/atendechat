import crypto from "crypto";
import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentIndexing from "../../models/AiKnowledgeDocumentIndexing";
import {
  knowledgeDocumentIndexQueue,
  KnowledgeDocumentIndexJobData
} from "../../libs/knowledgeDocumentIndexQueue";
import {
  KNOWLEDGE_CHUNKING_VERSION
} from "../../config/knowledgeBaseConstants";
import { findKnowledgeDocumentOrThrow } from "./knowledgeBaseTenant";
import ResolveKnowledgeEmbeddingSettingsService, {
  contentHashFromText
} from "./ResolveKnowledgeEmbeddingSettingsService";

export type EnqueueIndexingResult = {
  document: AiKnowledgeDocument;
  indexing: AiKnowledgeDocumentIndexing | null;
  enqueued: boolean;
  skippedReason?: string;
};

export default async function EnqueueKnowledgeDocumentIndexingService(input: {
  companyId: number;
  knowledgeDocumentId: number;
  force?: boolean;
}): Promise<EnqueueIndexingResult> {
  const document = await findKnowledgeDocumentOrThrow(
    input.companyId,
    input.knowledgeDocumentId
  );

  if (document.processingStatus !== "completed") {
    throw new AppError(
      "ERR_KNOWLEDGE_INDEX_NOT_PROCESSED",
      400,
      "O documento precisa estar processado (texto extraído) antes da indexação."
    );
  }

  const contentText = String(document.contentText || "").trim();
  if (!contentText) {
    throw new AppError(
      "ERR_KNOWLEDGE_INDEX_EMPTY_CONTENT",
      400,
      "Documento sem contentText válido para indexação."
    );
  }

  if (
    ["queued", "indexing"].includes(document.indexStatus) &&
    !input.force
  ) {
    throw new AppError(
      "ERR_KNOWLEDGE_INDEX_IN_PROGRESS",
      409,
      "Já existe uma indexação em andamento para este documento."
    );
  }

  const resolved = await ResolveKnowledgeEmbeddingSettingsService({
    companyId: input.companyId
  });

  const contentHash = contentHashFromText(contentText);
  const sourceChecksum = document.checksum || contentHash;

  if (!input.force && document.indexStatus === "completed") {
    const active = await AiKnowledgeDocumentIndexing.findOne({
      where: {
        companyId: input.companyId,
        knowledgeDocumentId: document.id,
        isActive: true,
        status: "completed"
      },
      order: [["id", "DESC"]]
    });
    if (
      active &&
      active.contentHash === contentHash &&
      active.configurationHash === resolved.configurationHash &&
      active.embeddingProvider === resolved.provider &&
      active.embeddingModel === resolved.model &&
      active.embeddingDimensions === resolved.dimensions &&
      active.chunkingVersion === KNOWLEDGE_CHUNKING_VERSION
    ) {
      return {
        document,
        indexing: active,
        enqueued: false,
        skippedReason: "already_indexed_same_config"
      };
    }
  }

  const attempt =
    (await AiKnowledgeDocumentIndexing.count({
      where: {
        companyId: input.companyId,
        knowledgeDocumentId: document.id
      }
    })) + 1;

  const indexVersion = `idx-${document.id}-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")}`;

  const indexing = await AiKnowledgeDocumentIndexing.create({
    companyId: input.companyId,
    knowledgeDocumentId: document.id,
    status: "queued",
    attempt,
    indexVersion,
    chunkingVersion: KNOWLEDGE_CHUNKING_VERSION,
    embeddingProvider: resolved.provider,
    embeddingModel: resolved.model,
    embeddingDimensions: resolved.dimensions,
    sourceChecksum,
    contentHash,
    configurationHash: resolved.configurationHash,
    chunksGenerated: 0,
    chunksEmbedded: 0,
    charactersProcessed: 0,
    tokensEstimated: null,
    isActive: false,
    logs: [
      {
        event: "queued",
        at: new Date().toISOString(),
        force: Boolean(input.force)
      }
    ]
  });

  await document.update({
    indexStatus: "queued",
    lastIndexingError: null
  });

  const jobData: KnowledgeDocumentIndexJobData = {
    companyId: input.companyId,
    knowledgeDocumentId: document.id,
    indexingId: indexing.id,
    force: Boolean(input.force)
  };

  try {
    await knowledgeDocumentIndexQueue.add(
      "ProcessKnowledgeDocumentIndex",
      jobData,
      {
        jobId: `kb-idx-${document.id}-${indexing.id}`,
        removeOnComplete: true,
        removeOnFail: false
      }
    );
  } catch {
    await indexing.update({
      status: "failed",
      finishedAt: new Date(),
      errorCode: "ERR_KNOWLEDGE_INDEX_QUEUE",
      errorMessage: "Fila de indexação indisponível."
    });
    await document.update({
      indexStatus: "failed",
      lastIndexingError: "Fila de indexação indisponível."
    });
    throw new AppError(
      "ERR_KNOWLEDGE_INDEX_QUEUE",
      503,
      "Fila de indexação indisponível."
    );
  }

  await document.reload();
  return { document, indexing, enqueued: true };
}
