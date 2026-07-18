import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import {
  KNOWLEDGE_INDEX_BATCH_MAX
} from "../../config/knowledgeBaseConstants";
import EnqueueKnowledgeDocumentIndexingService from "./EnqueueKnowledgeDocumentIndexingService";

/**
 * Enfileira indexação em lote com limite e confirmação de quantidade.
 */
export default async function EnqueueKnowledgeDocumentsBatchIndexingService(input: {
  companyId: number;
  mode: "pending" | "outdated" | "failed" | "selected";
  documentIds?: number[];
  confirmCount?: number;
}): Promise<{
  requested: number;
  enqueued: number;
  skipped: number;
  errors: Array<{ documentId: number; error: string }>;
}> {
  let where: Record<string, unknown> = {
    companyId: input.companyId,
    processingStatus: "completed"
  };

  if (input.mode === "pending") {
    where.indexStatus = "pending";
  } else if (input.mode === "outdated") {
    where.indexStatus = "outdated";
  } else if (input.mode === "failed") {
    where.indexStatus = "failed";
  } else if (input.mode === "selected") {
    const ids = (input.documentIds || []).filter(id => Number.isFinite(id));
    if (!ids.length) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Selecione ao menos um documento."
      );
    }
    where.id = { [Op.in]: ids };
  }

  const docs = await AiKnowledgeDocument.findAll({
    where,
    attributes: ["id"],
    limit: KNOWLEDGE_INDEX_BATCH_MAX + 1,
    order: [["id", "ASC"]]
  });

  if (docs.length > KNOWLEDGE_INDEX_BATCH_MAX) {
    throw new AppError(
      "ERR_KNOWLEDGE_INDEX_BATCH_LIMIT",
      400,
      `O lote excede o limite de ${KNOWLEDGE_INDEX_BATCH_MAX} documentos. Refine a seleção.`
    );
  }

  if (
    input.confirmCount != null &&
    Number(input.confirmCount) !== docs.length
  ) {
    throw new AppError(
      "ERR_KNOWLEDGE_INDEX_BATCH_CONFIRM",
      400,
      `Confirme a quantidade correta de documentos (${docs.length}).`
    );
  }

  let enqueued = 0;
  let skipped = 0;
  const errors: Array<{ documentId: number; error: string }> = [];

  for (const doc of docs) {
    try {
      const result = await EnqueueKnowledgeDocumentIndexingService({
        companyId: input.companyId,
        knowledgeDocumentId: doc.id,
        force: input.mode === "outdated" || input.mode === "failed"
      });
      if (result.enqueued) enqueued += 1;
      else skipped += 1;
    } catch (err) {
      errors.push({
        documentId: doc.id,
        error:
          err instanceof AppError
            ? err.clientMessage || err.message
            : "Falha ao enfileirar"
      });
    }
  }

  return {
    requested: docs.length,
    enqueued,
    skipped,
    errors
  };
}
