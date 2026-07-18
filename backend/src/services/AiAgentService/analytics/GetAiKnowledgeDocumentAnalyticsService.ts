import { WhereOptions } from "sequelize";
import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentStats from "../../../models/AiKnowledgeDocumentStats";
import { avg } from "./analyticsHelpers";

function parsePage(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(100, Math.floor(n));
}

export default async function GetAiKnowledgeDocumentAnalyticsService(input: {
  companyId: number;
  knowledgeBaseId?: number | null;
  documentId?: number | null;
  pageNumber?: unknown;
  limit?: unknown;
}) {
  const page = parsePage(input.pageNumber);
  const limit = parseLimit(input.limit);
  const offset = limit * (page - 1);

  if (input.documentId != null && Number.isFinite(Number(input.documentId))) {
    const documentId = Number(input.documentId);
    const stats = await AiKnowledgeDocumentStats.findOne({
      where: { companyId: input.companyId, documentId },
      include: [
        {
          model: AiKnowledgeDocument,
          attributes: [
            "id",
            "title",
            "knowledgeBaseId",
            "indexStatus",
            "chunkCount",
            "status"
          ],
          required: false
        }
      ]
    });

    if (!stats) {
      const doc = await AiKnowledgeDocument.findOne({
        where: { companyId: input.companyId, id: documentId },
        attributes: [
          "id",
          "title",
          "knowledgeBaseId",
          "indexStatus",
          "chunkCount",
          "status"
        ]
      });
      return {
        record: doc
          ? {
              documentId: doc.id,
              knowledgeBaseId: doc.knowledgeBaseId,
              title: doc.title,
              indexStatus: doc.indexStatus,
              chunkCount: doc.chunkCount,
              retrievalCount: 0,
              top1Count: 0,
              avgScore: null,
              lastRetrievedAt: null,
              lastUsedByAgentId: null,
              retrievalFailures: 0
            }
          : null,
        records: [],
        count: doc ? 1 : 0,
        hasMore: false,
        page: 1,
        limit
      };
    }

    const record = {
      documentId: stats.documentId,
      knowledgeBaseId: stats.knowledgeBaseId,
      title: stats.document?.title ?? null,
      indexStatus: stats.document?.indexStatus ?? null,
      chunkCount: stats.document?.chunkCount ?? null,
      retrievalCount: Number(stats.retrievalCount || 0),
      top1Count: Number(stats.top1Count || 0),
      avgScore: avg(Number(stats.sumScore || 0), Number(stats.scoreSamples || 0)),
      lastRetrievedAt: stats.lastRetrievedAt,
      lastUsedByAgentId: stats.lastUsedByAgentId,
      retrievalFailures: Number(stats.retrievalFailures || 0)
    };

    return {
      record,
      records: [record],
      count: 1,
      hasMore: false,
      page: 1,
      limit
    };
  }

  const where: WhereOptions = { companyId: input.companyId };
  if (
    input.knowledgeBaseId != null &&
    Number.isFinite(Number(input.knowledgeBaseId))
  ) {
    Object.assign(where, {
      knowledgeBaseId: Number(input.knowledgeBaseId)
    });
  }

  const { count, rows } = await AiKnowledgeDocumentStats.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ["retrievalCount", "DESC"],
      ["lastRetrievedAt", "DESC"]
    ],
    include: [
      {
        model: AiKnowledgeDocument,
        attributes: [
          "id",
          "title",
          "knowledgeBaseId",
          "indexStatus",
          "chunkCount",
          "status"
        ],
        required: false
      }
    ]
  });

  const records = rows.map(stats => ({
    documentId: stats.documentId,
    knowledgeBaseId: stats.knowledgeBaseId,
    title: stats.document?.title ?? null,
    indexStatus: stats.document?.indexStatus ?? null,
    chunkCount: stats.document?.chunkCount ?? null,
    retrievalCount: Number(stats.retrievalCount || 0),
    top1Count: Number(stats.top1Count || 0),
    avgScore: avg(Number(stats.sumScore || 0), Number(stats.scoreSamples || 0)),
    lastRetrievedAt: stats.lastRetrievedAt,
    lastUsedByAgentId: stats.lastUsedByAgentId,
    retrievalFailures: Number(stats.retrievalFailures || 0)
  }));

  return {
    record: null,
    records,
    count,
    hasMore: count > offset + rows.length,
    page,
    limit
  };
}
