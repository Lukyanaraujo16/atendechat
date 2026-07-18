import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentProcessing from "../../models/AiKnowledgeDocumentProcessing";
import {
  knowledgeDocumentQueue,
  KnowledgeDocumentJobData
} from "../../libs/knowledgeDocumentQueue";
import { resolveKnowledgeProcessor } from "./processors";
import { findKnowledgeDocumentOrThrow } from "./knowledgeBaseTenant";

export type EnqueueProcessingResult = {
  document: AiKnowledgeDocument;
  processing: AiKnowledgeDocumentProcessing | null;
  enqueued: boolean;
  skippedReason?: string;
};

/**
 * Regista histórico + coloca job na fila Bull. Responde sem esperar extração.
 * Se checksum não mudou e já completed, não reprocessa automaticamente (salvo force).
 */
export default async function EnqueueKnowledgeDocumentProcessingService(input: {
  companyId: number;
  knowledgeDocumentId: number;
  force?: boolean;
}): Promise<EnqueueProcessingResult> {
  const document = await findKnowledgeDocumentOrThrow(
    input.companyId,
    input.knowledgeDocumentId
  );

  if (
    ["queued", "processing"].includes(document.processingStatus) &&
    !input.force
  ) {
    throw new AppError(
      "ERR_KNOWLEDGE_PROCESSING_IN_PROGRESS",
      409,
      "Já existe um processamento em andamento para este documento."
    );
  }

  if (
    !input.force &&
    document.processingStatus === "completed" &&
    document.checksum &&
    document.lastProcessedChecksum &&
    document.checksum === document.lastProcessedChecksum
  ) {
    return {
      document,
      processing: null,
      enqueued: false,
      skippedReason: "checksum_unchanged"
    };
  }

  const processor = resolveKnowledgeProcessor(document);
  const attempt =
    (await AiKnowledgeDocumentProcessing.count({
      where: {
        companyId: input.companyId,
        knowledgeDocumentId: document.id
      }
    })) + 1;

  const processing = await AiKnowledgeDocumentProcessing.create({
    companyId: input.companyId,
    knowledgeDocumentId: document.id,
    processor: processor.name,
    status: "queued",
    attempt,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    errorMessage: null,
    logs: [
      {
        event: "queued",
        at: new Date().toISOString(),
        processor: processor.name,
        force: Boolean(input.force)
      }
    ]
  });

  await document.update({
    processingStatus: "queued",
    lastProcessingError: null,
    status:
      document.status === "draft" || document.status === "ready"
        ? "processing"
        : document.status
  });

  const jobData: KnowledgeDocumentJobData = {
    companyId: input.companyId,
    knowledgeDocumentId: document.id,
    processingId: processing.id,
    force: Boolean(input.force)
  };

  try {
    await knowledgeDocumentQueue.add("ProcessKnowledgeDocument", jobData, {
      jobId: `kb-doc-${document.id}-proc-${processing.id}`,
      removeOnComplete: true,
      removeOnFail: false
    });
  } catch (err) {
    await processing.update({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: "Fila de processamento indisponível.",
      logs: [
        ...(processing.logs || []),
        {
          event: "failed",
          at: new Date().toISOString(),
          error: "queue_unavailable"
        }
      ]
    });
    await document.update({
      processingStatus: "failed",
      lastProcessingError: "Fila de processamento indisponível.",
      status: "error"
    });
    throw new AppError(
      "ERR_KNOWLEDGE_PROCESSING_QUEUE",
      503,
      "Fila de processamento indisponível. Tente novamente em breve."
    );
  }

  await document.reload();
  return { document, processing, enqueued: true };
}
