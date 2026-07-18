import { Op } from "sequelize";
import AiKnowledgeBase from "../../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentChunk from "../../models/AiKnowledgeDocumentChunk";
import AiKnowledgeEmbeddingSettings from "../../models/AiKnowledgeEmbeddingSettings";

export default async function GetKnowledgeBaseDashboardService(input: {
  companyId: number;
}): Promise<Record<string, unknown>> {
  const companyId = input.companyId;
  const [
    basesTotal,
    basesActive,
    documentsTotal,
    uploadsTotal,
    websitesTotal,
    manualsTotal,
    documentsProcessed,
    documentsPending,
    documentsProcessing,
    documentsError,
    lastProcessedDoc,
    indexPending,
    indexQueued,
    indexIndexing,
    indexCompleted,
    indexFailed,
    indexOutdated,
    chunksTotal,
    lastIndexedDoc,
    embeddingSettings
  ] = await Promise.all([
    AiKnowledgeBase.count({ where: { companyId } }),
    AiKnowledgeBase.count({ where: { companyId, enabled: true } }),
    AiKnowledgeDocument.count({ where: { companyId } }),
    AiKnowledgeDocument.count({
      where: { companyId, sourceType: "upload" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, sourceType: "website" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, sourceType: "manual" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, processingStatus: "completed" }
    }),
    AiKnowledgeDocument.count({
      where: {
        companyId,
        processingStatus: { [Op.in]: ["pending", "queued"] }
      }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, processingStatus: "processing" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, processingStatus: "failed" }
    }),
    AiKnowledgeDocument.findOne({
      where: {
        companyId,
        lastProcessedAt: { [Op.ne]: null }
      },
      order: [["lastProcessedAt", "DESC"]],
      attributes: ["lastProcessedAt"]
    }),
    AiKnowledgeDocument.count({
      where: { companyId, indexStatus: "pending" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, indexStatus: "queued" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, indexStatus: "indexing" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, indexStatus: "completed" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, indexStatus: "failed" }
    }),
    AiKnowledgeDocument.count({
      where: { companyId, indexStatus: "outdated" }
    }),
    AiKnowledgeDocumentChunk.count({
      where: { companyId, enabled: true }
    }),
    AiKnowledgeDocument.findOne({
      where: {
        companyId,
        lastIndexedAt: { [Op.ne]: null }
      },
      order: [["lastIndexedAt", "DESC"]],
      attributes: ["lastIndexedAt"]
    }),
    AiKnowledgeEmbeddingSettings.findOne({ where: { companyId } })
  ]);

  return {
    basesTotal,
    basesActive,
    basesInactive: basesTotal - basesActive,
    documentsTotal,
    uploadsTotal,
    websitesTotal,
    manualsTotal,
    documentsProcessed,
    documentsPending,
    documentsProcessing,
    documentsError,
    lastProcessingAt: lastProcessedDoc?.lastProcessedAt || null,
    indexPending,
    indexQueued,
    indexIndexing,
    indexCompleted,
    indexFailed,
    indexOutdated,
    chunksTotal,
    lastIndexingAt: lastIndexedDoc?.lastIndexedAt || null,
    embeddingProvider: embeddingSettings?.provider || null,
    embeddingModel: embeddingSettings?.model || null,
    embeddingEnabled: embeddingSettings?.enabled ?? null
  };
}
