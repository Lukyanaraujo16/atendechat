import { Op, WhereOptions } from "sequelize";
import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import {
  KNOWLEDGE_PROCESSING_STATUSES,
  KnowledgeProcessingStatus
} from "../../config/knowledgeBaseConstants";
import {
  characterCountPreview,
  findKnowledgeBaseOrThrow,
  normalizeOptionalString,
  parseDocumentStatus,
  parseDocumentType,
  parseSourceType
} from "./knowledgeBaseTenant";

function parseProcessingStatus(value: unknown): KnowledgeProcessingStatus {
  const s = String(value ?? "").trim();
  if (!(KNOWLEDGE_PROCESSING_STATUSES as readonly string[]).includes(s)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "processingStatus inválido."
    );
  }
  return s as KnowledgeProcessingStatus;
}

export default async function ListKnowledgeDocumentsService(input: {
  companyId: number;
  knowledgeBaseId: number;
  search?: unknown;
  documentType?: unknown;
  sourceType?: unknown;
  status?: unknown;
  processingStatus?: unknown;
  language?: unknown;
}): Promise<{
  documents: Array<Record<string, unknown>>;
  count: number;
}> {
  await findKnowledgeBaseOrThrow(input.companyId, input.knowledgeBaseId);

  const where: WhereOptions = {
    companyId: input.companyId,
    knowledgeBaseId: input.knowledgeBaseId
  };

  const search = normalizeOptionalString(input.search);
  if (search) {
    Object.assign(where, {
      [Op.or]: [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ]
    });
  }

  if (input.documentType) {
    Object.assign(where, {
      documentType: parseDocumentType(input.documentType)
    });
  }
  if (input.sourceType) {
    Object.assign(where, { sourceType: parseSourceType(input.sourceType) });
  }
  if (input.status) {
    Object.assign(where, {
      status: parseDocumentStatus(input.status, "draft")
    });
  }
  if (input.processingStatus) {
    Object.assign(where, {
      processingStatus: parseProcessingStatus(input.processingStatus)
    });
  }
  const language = normalizeOptionalString(input.language);
  if (language) {
    Object.assign(where, { language });
  }

  const documents = await AiKnowledgeDocument.findAll({
    where,
    order: [["updatedAt", "DESC"]]
  });

  return {
    documents: documents.map(d => ({
      ...d.toJSON(),
      characterCount: characterCountPreview(d)
    })),
    count: documents.length
  };
}
