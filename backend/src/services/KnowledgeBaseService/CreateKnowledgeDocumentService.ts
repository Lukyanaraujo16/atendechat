import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import {
  findKnowledgeBaseOrThrow,
  normalizeOptionalString,
  parseDocumentStatus,
  parseDocumentType,
  parseLanguage,
  parseOptionalUrl,
  parseRequiredTitle,
  parseSourceType
} from "./knowledgeBaseTenant";

type CreateBody = {
  title?: unknown;
  description?: unknown;
  documentType?: unknown;
  sourceType?: unknown;
  status?: unknown;
  language?: unknown;
  contentText?: unknown;
  contentMarkdown?: unknown;
  sourceUrl?: unknown;
  metadata?: unknown;
};

export default async function CreateKnowledgeDocumentService(input: {
  companyId: number;
  knowledgeBaseId: number;
  userId: number | null;
  body: CreateBody;
}): Promise<AiKnowledgeDocument> {
  await findKnowledgeBaseOrThrow(input.companyId, input.knowledgeBaseId);

  const sourceType = parseSourceType(input.body.sourceType ?? "manual");
  const title = parseRequiredTitle(input.body.title);
  const description = normalizeOptionalString(input.body.description);
  const documentType = parseDocumentType(input.body.documentType ?? "general");
  const status = parseDocumentStatus(input.body.status, "draft");
  const language = parseLanguage(input.body.language);
  const contentText = normalizeOptionalString(input.body.contentText);
  const contentMarkdown = normalizeOptionalString(input.body.contentMarkdown);
  const sourceUrl =
    sourceType === "website"
      ? parseOptionalUrl(input.body.sourceUrl)
      : normalizeOptionalString(input.body.sourceUrl);

  if (sourceType === "website" && !sourceUrl) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "sourceUrl é obrigatório para documentos do tipo website."
    );
  }

  let metadata: Record<string, unknown> | null = null;
  if (input.body.metadata != null && typeof input.body.metadata === "object") {
    metadata = input.body.metadata as Record<string, unknown>;
  }

  const doc = await AiKnowledgeDocument.create({
    companyId: input.companyId,
    knowledgeBaseId: input.knowledgeBaseId,
    title,
    description,
    documentType,
    sourceType,
    status,
    language,
    contentText,
    contentMarkdown,
    sourceUrl,
    uploadStatus: "pending",
    processingStatus: "pending",
    indexStatus: "pending",
    metadata,
    createdBy: input.userId,
    updatedBy: input.userId
  });

  // Website / manual com conteúdo: enfileirar extração assíncrona
  const shouldEnqueue =
    sourceType === "website" ||
    (sourceType === "manual" && Boolean(contentText || contentMarkdown));

  if (shouldEnqueue) {
    try {
      const EnqueueKnowledgeDocumentProcessingService = (
        await import("./EnqueueKnowledgeDocumentProcessingService")
      ).default;
      await EnqueueKnowledgeDocumentProcessingService({
        companyId: input.companyId,
        knowledgeDocumentId: doc.id,
        force: false
      });
      await doc.reload();
    } catch {
      // Fila indisponível não bloqueia o CRUD
    }
  }

  return doc;
}
