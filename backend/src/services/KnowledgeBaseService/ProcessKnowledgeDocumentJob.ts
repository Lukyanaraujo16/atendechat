import fs from "fs";
import path from "path";
import { Job } from "bull";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentProcessing from "../../models/AiKnowledgeDocumentProcessing";
import { KNOWLEDGE_PROCESSING_TIMEOUT_MS } from "../../config/knowledgeBaseConstants";
import type { KnowledgeDocumentJobData } from "../../libs/knowledgeDocumentQueue";
import { resolveKnowledgeProcessor } from "./processors";
import type { ProcessorResult } from "./processors/types";

function appendLog(
  logs: Record<string, unknown>[] | null | undefined,
  entry: Record<string, unknown>
): Record<string, unknown>[] {
  return [...(logs || []), { ...entry, at: new Date().toISOString() }];
}

function resolveAbsolutePath(storagePath: string | null): string | null {
  if (!storagePath) return null;
  if (path.isAbsolute(storagePath)) return storagePath;
  return path.resolve(process.cwd(), storagePath);
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
            new AppError("ERR_KNOWLEDGE_PROCESSING_TIMEOUT", 408, message)
          );
        }, ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function friendlyError(err: unknown): string {
  if (err instanceof AppError) {
    return err.clientMessage || err.message;
  }
  if (err instanceof Error) return err.message;
  return "Falha desconhecida no processamento.";
}

/**
 * Worker Bull: extrai texto limpo e atualiza documento + histórico.
 * Não gera embeddings/chunks (fase 1.5.2C).
 */
export async function processKnowledgeDocumentJob(
  job: Job<KnowledgeDocumentJobData>
): Promise<{ ok: boolean; processingId: number }> {
  const { companyId, knowledgeDocumentId, processingId } = job.data;
  const startedAt = new Date();

  const processing = await AiKnowledgeDocumentProcessing.findOne({
    where: { id: processingId, companyId, knowledgeDocumentId }
  });
  const document = await AiKnowledgeDocument.findOne({
    where: { id: knowledgeDocumentId, companyId }
  });

  if (!processing || !document) {
    logger.warn(
      `[KB] Job ${job.id}: processing/document não encontrado (${processingId}/${knowledgeDocumentId})`
    );
    return { ok: false, processingId };
  }

  await processing.update({
    status: "processing",
    startedAt,
    logs: appendLog(processing.logs, {
      event: "started",
      processor: processing.processor
    })
  });
  await document.update({
    processingStatus: "processing",
    status: "processing"
  });

  try {
    const processor = resolveKnowledgeProcessor(document);
    const absolutePath = resolveAbsolutePath(document.storagePath);
    let fileBuffer: Buffer | null = null;
    if (absolutePath && fs.existsSync(absolutePath)) {
      fileBuffer = fs.readFileSync(absolutePath);
    }

    const result: ProcessorResult = await withTimeout(
      processor.process({
        document,
        fileBuffer,
        absolutePath
      }),
      KNOWLEDGE_PROCESSING_TIMEOUT_MS,
      "Tempo limite de processamento excedido."
    );

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await document.update({
      contentText: result.contentText,
      contentMarkdown:
        result.contentMarkdown !== undefined
          ? result.contentMarkdown
          : document.contentMarkdown,
      processingStatus: "completed",
      indexStatus: "pending",
      lastProcessedAt: finishedAt,
      lastProcessor: result.processor,
      lastProcessingError: null,
      lastProcessedChecksum: document.checksum || null,
      lastProcessingDurationMs: durationMs,
      status: "ready",
      uploadStatus:
        document.sourceType === "upload" ? "uploaded" : document.uploadStatus
    });

    await processing.update({
      status: "completed",
      processor: result.processor,
      finishedAt,
      durationMs,
      errorMessage: null,
      logs: appendLog(processing.logs, {
        event: "completed",
        durationMs,
        chars: result.contentText.length,
        ...(result.logs ? { details: result.logs } : {})
      })
    });

    return { ok: true, processingId };
  } catch (err) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = friendlyError(err);

    logger.error(
      `[KB] Processamento falhou doc=${knowledgeDocumentId}: ${message}`
    );

    await document.update({
      processingStatus: "failed",
      lastProcessedAt: finishedAt,
      lastProcessingError: message,
      lastProcessingDurationMs: durationMs,
      status: "error",
      uploadStatus:
        document.sourceType === "upload" && document.storagePath
          ? "uploaded"
          : document.uploadStatus
    });

    await processing.update({
      status: "failed",
      finishedAt,
      durationMs,
      errorMessage: message,
      logs: appendLog(processing.logs, {
        event: "failed",
        error: message,
        durationMs
      })
    });

    return { ok: false, processingId };
  }
}

export default processKnowledgeDocumentJob;
