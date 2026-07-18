import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import {
  findKnowledgeDocumentOrThrow,
  normalizeOptionalString,
  parseDocumentStatus,
  parseDocumentType,
  parseLanguage,
  parseOptionalUrl,
  parseRequiredTitle
} from "./knowledgeBaseTenant";

type UpdateBody = {
  title?: unknown;
  description?: unknown;
  documentType?: unknown;
  status?: unknown;
  language?: unknown;
  contentText?: unknown;
  contentMarkdown?: unknown;
  sourceUrl?: unknown;
  metadata?: unknown;
};

export default async function UpdateKnowledgeDocumentService(input: {
  companyId: number;
  id: number;
  userId: number | null;
  body: UpdateBody;
}): Promise<AiKnowledgeDocument> {
  const row = await findKnowledgeDocumentOrThrow(input.companyId, input.id);
  const patch: Partial<AiKnowledgeDocument> & Record<string, unknown> = {
    updatedBy: input.userId
  };

  if (input.body.title !== undefined) {
    patch.title = parseRequiredTitle(input.body.title);
  }
  if (input.body.description !== undefined) {
    patch.description = normalizeOptionalString(input.body.description);
  }
  if (input.body.documentType !== undefined) {
    patch.documentType = parseDocumentType(input.body.documentType);
  }
  if (input.body.status !== undefined) {
    patch.status = parseDocumentStatus(input.body.status, row.status);
  }
  if (input.body.language !== undefined) {
    patch.language = parseLanguage(input.body.language);
  }
  if (input.body.contentText !== undefined) {
    patch.contentText = normalizeOptionalString(input.body.contentText);
  }
  if (input.body.contentMarkdown !== undefined) {
    patch.contentMarkdown = normalizeOptionalString(input.body.contentMarkdown);
  }

  const contentChanging =
    (input.body.contentText !== undefined &&
      patch.contentText !== row.contentText) ||
    (input.body.contentMarkdown !== undefined &&
      patch.contentMarkdown !== row.contentMarkdown);

  if (contentChanging && row.indexStatus === "completed") {
    patch.indexStatus = "outdated";
    patch.lastIndexingError =
      "Conteúdo alterado — reindexação necessária.";
  } else if (contentChanging && row.processingStatus === "completed") {
    patch.indexStatus = "pending";
  }

  if (input.body.sourceUrl !== undefined) {
    if (row.sourceType === "website") {
      const url = parseOptionalUrl(input.body.sourceUrl);
      if (!url) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "sourceUrl é obrigatório para documentos do tipo website."
        );
      }
      patch.sourceUrl = url;
    } else {
      patch.sourceUrl = normalizeOptionalString(input.body.sourceUrl);
    }
  }
  if (input.body.metadata !== undefined) {
    if (input.body.metadata == null) {
      patch.metadata = null;
    } else if (typeof input.body.metadata === "object") {
      patch.metadata = input.body.metadata as Record<string, unknown>;
    }
  }

  await row.update(patch);
  return row.reload();
}
