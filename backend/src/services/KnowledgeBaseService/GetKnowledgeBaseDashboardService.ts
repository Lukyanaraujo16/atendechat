import { Op } from "sequelize";
import AiKnowledgeBase from "../../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";

export default async function GetKnowledgeBaseDashboardService(input: {
  companyId: number;
}): Promise<{
  basesTotal: number;
  basesActive: number;
  basesInactive: number;
  documentsTotal: number;
  uploadsTotal: number;
  websitesTotal: number;
  manualsTotal: number;
  documentsProcessed: number;
  documentsPending: number;
  documentsProcessing: number;
  documentsError: number;
  lastProcessingAt: Date | null;
}> {
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
    lastProcessedDoc
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
    })
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
    lastProcessingAt: lastProcessedDoc?.lastProcessedAt || null
  };
}
