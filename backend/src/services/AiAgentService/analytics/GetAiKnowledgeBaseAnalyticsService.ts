import { WhereOptions } from "sequelize";
import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentStats from "../../../models/AiKnowledgeDocumentStats";
import { avg } from "./analyticsHelpers";

export default async function GetAiKnowledgeBaseAnalyticsService(input: {
  companyId: number;
  knowledgeBaseId?: number | null;
}) {
  const docWhere: WhereOptions = { companyId: input.companyId };
  if (
    input.knowledgeBaseId != null &&
    Number.isFinite(Number(input.knowledgeBaseId))
  ) {
    Object.assign(docWhere, {
      knowledgeBaseId: Number(input.knowledgeBaseId)
    });
  }

  const documents = await AiKnowledgeDocument.findAll({
    where: docWhere,
    attributes: [
      "id",
      "title",
      "knowledgeBaseId",
      "indexStatus",
      "chunkCount",
      "status"
    ]
  });

  const documentCount = documents.length;
  const indexedDocuments = documents.filter(
    d => d.indexStatus === "completed"
  ).length;
  const outdatedDocuments = documents.filter(
    d => d.indexStatus === "outdated"
  ).length;

  const chunkSum = documents.reduce(
    (acc, d) => acc + Number(d.chunkCount || 0),
    0
  );
  const averageChunksPerDocument =
    documentCount > 0 ? chunkSum / documentCount : null;

  const statsWhere: WhereOptions = { companyId: input.companyId };
  if (
    input.knowledgeBaseId != null &&
    Number.isFinite(Number(input.knowledgeBaseId))
  ) {
    Object.assign(statsWhere, {
      knowledgeBaseId: Number(input.knowledgeBaseId)
    });
  }

  const stats = await AiKnowledgeDocumentStats.findAll({
    where: statsWhere,
    include: [
      {
        model: AiKnowledgeDocument,
        attributes: ["id", "title", "knowledgeBaseId", "indexStatus"],
        required: false
      }
    ]
  });

  let retrievalCount = 0;
  let sumScore = 0;
  let scoreSamples = 0;
  let lastRetrievalAt: Date | null = null;

  const withUsage = stats.map(s => {
    retrievalCount += Number(s.retrievalCount || 0);
    sumScore += Number(s.sumScore || 0);
    scoreSamples += Number(s.scoreSamples || 0);
    if (
      s.lastRetrievedAt &&
      (!lastRetrievalAt || s.lastRetrievedAt > lastRetrievalAt)
    ) {
      lastRetrievalAt = s.lastRetrievedAt;
    }
    return {
      documentId: s.documentId,
      knowledgeBaseId: s.knowledgeBaseId,
      title: s.document?.title ?? null,
      retrievalCount: Number(s.retrievalCount || 0),
      avgScore: avg(Number(s.sumScore || 0), Number(s.scoreSamples || 0)),
      lastRetrievedAt: s.lastRetrievedAt
    };
  });

  const sortedByUsage = [...withUsage].sort(
    (a, b) => b.retrievalCount - a.retrievalCount
  );
  const mostUsed = sortedByUsage.slice(0, 10);
  const leastUsed = [...sortedByUsage]
    .filter(d => d.retrievalCount > 0)
    .sort((a, b) => a.retrievalCount - b.retrievalCount)
    .slice(0, 10);

  const usedIds = new Set(stats.map(s => s.documentId));
  const unused = documents
    .filter(d => !usedIds.has(d.id) || !stats.some(s => s.documentId === d.id && Number(s.retrievalCount || 0) > 0))
    .map(d => ({
      documentId: d.id,
      knowledgeBaseId: d.knowledgeBaseId,
      title: d.title,
      indexStatus: d.indexStatus
    }))
    .slice(0, 50);

  return {
    documentCount,
    indexedDocuments,
    outdatedDocuments,
    averageChunksPerDocument,
    retrievalCount,
    avgScore: avg(sumScore, scoreSamples),
    lastRetrievalAt,
    mostUsed,
    leastUsed,
    unused
  };
}
