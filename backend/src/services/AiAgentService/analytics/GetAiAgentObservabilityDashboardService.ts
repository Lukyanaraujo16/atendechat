import { Op, WhereOptions } from "sequelize";
import AiAgentAnalyticsDaily from "../../../models/AiAgentAnalyticsDaily";
import AiKnowledgeDocumentStats from "../../../models/AiKnowledgeDocumentStats";
import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import AiKnowledgeGap from "../../../models/AiKnowledgeGap";
import GetAiAgentAnalyticsService from "./GetAiAgentAnalyticsService";
import { avg } from "./analyticsHelpers";

export default async function GetAiAgentObservabilityDashboardService(input: {
  companyId: number;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
}) {
  const analytics = await GetAiAgentAnalyticsService({
    companyId: input.companyId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo
  });

  const dayWhere: WhereOptions = { companyId: input.companyId };
  if (input.dateFrom || input.dateTo) {
    const dayFilter: Record<symbol | string, unknown> = {};
    if (input.dateFrom) {
      dayFilter[Op.gte] =
        typeof input.dateFrom === "string"
          ? input.dateFrom.slice(0, 10)
          : input.dateFrom.toISOString().slice(0, 10);
    }
    if (input.dateTo) {
      dayFilter[Op.lte] =
        typeof input.dateTo === "string"
          ? input.dateTo.slice(0, 10)
          : input.dateTo.toISOString().slice(0, 10);
    }
    Object.assign(dayWhere, { day: dayFilter });
  }

  const dailyRows = await AiAgentAnalyticsDaily.findAll({
    where: dayWhere,
    attributes: [
      "aiAgentId",
      "totalInteractions",
      "knowledgeHits",
      "knowledgeMisses",
      "handoffs",
      "failures",
      "sumResponseTimeMs",
      "countResponseTime"
    ]
  });

  const agentAgg = new Map<
    number,
    {
      aiAgentId: number;
      interactions: number;
      hits: number;
      misses: number;
      handoffs: number;
      failures: number;
      sumResponseTimeMs: number;
      countResponseTime: number;
    }
  >();

  for (const row of dailyRows) {
    const cur = agentAgg.get(row.aiAgentId) || {
      aiAgentId: row.aiAgentId,
      interactions: 0,
      hits: 0,
      misses: 0,
      handoffs: 0,
      failures: 0,
      sumResponseTimeMs: 0,
      countResponseTime: 0
    };
    cur.interactions += Number(row.totalInteractions || 0);
    cur.hits += Number(row.knowledgeHits || 0);
    cur.misses += Number(row.knowledgeMisses || 0);
    cur.handoffs += Number(row.handoffs || 0);
    cur.failures += Number(row.failures || 0);
    cur.sumResponseTimeMs += Number(row.sumResponseTimeMs || 0);
    cur.countResponseTime += Number(row.countResponseTime || 0);
    agentAgg.set(row.aiAgentId, cur);
  }

  const agentsTop10 = [...agentAgg.values()]
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, 10)
    .map(a => ({
      ...a,
      avgResponseTimeMs: avg(a.sumResponseTimeMs, a.countResponseTime)
    }));

  const gapTop10 = await AiKnowledgeGap.findAll({
    where: {
      companyId: input.companyId,
      resolved: false
    },
    order: [
      ["frequency", "DESC"],
      ["lastSeenAt", "DESC"]
    ],
    limit: 10
  });

  const docStats = await AiKnowledgeDocumentStats.findAll({
    where: { companyId: input.companyId },
    order: [["retrievalCount", "DESC"]],
    limit: 10,
    include: [
      {
        model: AiKnowledgeDocument,
        attributes: ["id", "title"],
        required: false
      }
    ]
  });

  const documentsTop10 = docStats.map(s => ({
    documentId: s.documentId,
    title: s.document?.title ?? null,
    retrievalCount: Number(s.retrievalCount || 0),
    avgScore: avg(Number(s.sumScore || 0), Number(s.scoreSamples || 0)),
    lastRetrievedAt: s.lastRetrievedAt
  }));

  return {
    interactions: {
      total: analytics.totals.totalInteractions,
      simulator: analytics.totals.simulatorExecutions,
      shadow: analytics.totals.shadowSuggestions,
      live: analytics.totals.liveResponses
    },
    retrieval: {
      total: analytics.totals.knowledgeRetrievals,
      hits: analytics.totals.knowledgeHits,
      misses: analytics.totals.knowledgeMisses,
      hitRate: analytics.averages.hitRate,
      missRate: analytics.averages.missRate,
      avgScore: analytics.averages.avgKnowledgeScore
    },
    latency: {
      avgResponseTimeMs: analytics.averages.avgResponseTimeMs,
      avgRetrievalTimeMs: analytics.averages.avgRetrievalTimeMs,
      avgEmbeddingTimeMs: analytics.averages.avgEmbeddingTimeMs,
      avgGenerationTimeMs: analytics.averages.avgGenerationTimeMs
    },
    handoffs: analytics.totals.handoffs,
    clarifications: analytics.totals.clarificationRequests,
    failures: analytics.totals.failures,
    providerUsage: analytics.providerUsage,
    modelUsage: analytics.modelUsage,
    estimatedCost: analytics.estimatedCost,
    gapTop10,
    documentsTop10,
    agentsTop10
  };
}
