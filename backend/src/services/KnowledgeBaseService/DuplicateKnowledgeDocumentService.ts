import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import { findKnowledgeDocumentOrThrow } from "./knowledgeBaseTenant";

/**
 * Duplica metadados e conteúdo textual. Não copia arquivo físico de upload
 * (storagePath/checksum ficam nulos na cópia) — upload deve ser refeito.
 */
export default async function DuplicateKnowledgeDocumentService(input: {
  companyId: number;
  id: number;
  userId: number | null;
}): Promise<AiKnowledgeDocument> {
  const source = await findKnowledgeDocumentOrThrow(input.companyId, input.id);
  const copyTitle = `${source.title} (cópia)`.slice(0, 255);

  return AiKnowledgeDocument.create({
    companyId: input.companyId,
    knowledgeBaseId: source.knowledgeBaseId,
    title: copyTitle,
    description: source.description,
    documentType: source.documentType,
    sourceType: source.sourceType === "upload" ? "manual" : source.sourceType,
    status: "draft",
    language: source.language,
    contentText: source.contentText,
    contentMarkdown: source.contentMarkdown,
    sourceUrl: source.sourceUrl,
    fileName: null,
    mimeType: null,
    fileSize: null,
    checksum: null,
    storagePath: null,
    uploadStatus: "pending",
    processingStatus: source.contentText || source.contentMarkdown
      ? "completed"
      : "pending",
    indexStatus: "pending",
    lastProcessedAt: null,
    lastProcessor: null,
    lastProcessingError: null,
    lastProcessedChecksum: null,
    lastProcessingDurationMs: null,
    lastIndexedAt: null,
    lastIndexingError: null,
    lastIndexedChecksum: null,
    lastIndexingDurationMs: null,
    lastEmbeddingProvider: null,
    lastEmbeddingModel: null,
    lastEmbeddingDimensions: null,
    lastChunkingVersion: null,
    chunkCount: 0,
    activeIndexingId: null,
    metadata: source.metadata,
    createdBy: input.userId,
    updatedBy: input.userId
  });
}
