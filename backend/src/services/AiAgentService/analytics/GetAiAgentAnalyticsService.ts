import { Op, WhereOptions } from "sequelize";
import AiAgentAnalyticsDaily from "../../../models/AiAgentAnalyticsDaily";
import { avg } from "./analyticsHelpers";

function mergeUsageMaps(
  rows: Array<{ providerUsage?: Record<string, number> | null; modelUsage?: Record<string, number> | null }>
): {
  providerUsage: Record<string, number>;
  modelUsage: Record<string, number>;
} {
  const providerUsage: Record<string, number> = {};
  const modelUsage: Record<string, number> = {};

  for (const row of rows) {
    if (row.providerUsage && typeof row.providerUsage === "object") {
      for (const [k, v] of Object.entries(row.providerUsage)) {
        providerUsage[k] = Number(providerUsage[k] || 0) + Number(v || 0);
      }
    }
    if (row.modelUsage && typeof row.modelUsage === "object") {
      for (const [k, v] of Object.entries(row.modelUsage)) {
        modelUsage[k] = Number(modelUsage[k] || 0) + Number(v || 0);
      }
    }
  }

  return { providerUsage, modelUsage };
}

function estimateCostFromMetadata(
  rows: Array<{ metadata?: Record<string, unknown> | null }>
): number | null {
  let total = 0;
  let found = false;

  for (const row of rows) {
    const meta = row.metadata;
    if (!meta || typeof meta !== "object") continue;
    const unitCost = Number((meta as { unitCost?: unknown }).unitCost);
    const tokens = Number((meta as { tokens?: unknown }).tokens);
    if (Number.isFinite(unitCost) && Number.isFinite(tokens) && tokens > 0) {
      total += unitCost * tokens;
      found = true;
    }
  }

  return found ? total : null;
}

export default async function GetAiAgentAnalyticsService(input: {
  companyId: number;
  aiAgentId?: number | null;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
}) {
  const where: WhereOptions = { companyId: input.companyId };

  if (input.aiAgentId != null && Number.isFinite(Number(input.aiAgentId))) {
    Object.assign(where, { aiAgentId: Number(input.aiAgentId) });
  }

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
    Object.assign(where, { day: dayFilter });
  }

  const rows = await AiAgentAnalyticsDaily.findAll({ where });

  let totalInteractions = 0;
  let simulatorExecutions = 0;
  let shadowSuggestions = 0;
  let liveResponses = 0;
  let knowledgeRetrievals = 0;
  let knowledgeHits = 0;
  let knowledgeMisses = 0;
  let handoffs = 0;
  let clarificationRequests = 0;
  let failures = 0;
  let sumResponseTimeMs = 0;
  let countResponseTime = 0;
  let sumRetrievalTimeMs = 0;
  let countRetrievalTime = 0;
  let sumEmbeddingTimeMs = 0;
  let countEmbeddingTime = 0;
  let sumGenerationTimeMs = 0;
  let countGenerationTime = 0;
  let sumKnowledgeScore = 0;
  let countKnowledgeScore = 0;
  let sumChunks = 0;
  let sumContextTokens = 0;
  let estimatedTokensInput = 0;
  let estimatedTokensOutput = 0;

  for (const row of rows) {
    totalInteractions += Number(row.totalInteractions || 0);
    simulatorExecutions += Number(row.simulatorExecutions || 0);
    shadowSuggestions += Number(row.shadowSuggestions || 0);
    liveResponses += Number(row.liveResponses || 0);
    knowledgeRetrievals += Number(row.knowledgeRetrievals || 0);
    knowledgeHits += Number(row.knowledgeHits || 0);
    knowledgeMisses += Number(row.knowledgeMisses || 0);
    handoffs += Number(row.handoffs || 0);
    clarificationRequests += Number(row.clarificationRequests || 0);
    failures += Number(row.failures || 0);
    sumResponseTimeMs += Number(row.sumResponseTimeMs || 0);
    countResponseTime += Number(row.countResponseTime || 0);
    sumRetrievalTimeMs += Number(row.sumRetrievalTimeMs || 0);
    countRetrievalTime += Number(row.countRetrievalTime || 0);
    sumEmbeddingTimeMs += Number(row.sumEmbeddingTimeMs || 0);
    countEmbeddingTime += Number(row.countEmbeddingTime || 0);
    sumGenerationTimeMs += Number(row.sumGenerationTimeMs || 0);
    countGenerationTime += Number(row.countGenerationTime || 0);
    sumKnowledgeScore += Number(row.sumKnowledgeScore || 0);
    countKnowledgeScore += Number(row.countKnowledgeScore || 0);
    sumChunks += Number(row.sumChunks || 0);
    sumContextTokens += Number(row.sumContextTokens || 0);
    estimatedTokensInput += Number(row.estimatedTokensInput || 0);
    estimatedTokensOutput += Number(row.estimatedTokensOutput || 0);
  }

  const { providerUsage, modelUsage } = mergeUsageMaps(rows);

  return {
    totals: {
      totalInteractions,
      simulatorExecutions,
      shadowSuggestions,
      liveResponses,
      knowledgeRetrievals,
      knowledgeHits,
      knowledgeMisses,
      handoffs,
      clarificationRequests,
      failures,
      estimatedTokensInput,
      estimatedTokensOutput,
      sumChunks,
      sumContextTokens
    },
    averages: {
      avgResponseTimeMs: avg(sumResponseTimeMs, countResponseTime),
      avgRetrievalTimeMs: avg(sumRetrievalTimeMs, countRetrievalTime),
      avgEmbeddingTimeMs: avg(sumEmbeddingTimeMs, countEmbeddingTime),
      avgGenerationTimeMs: avg(sumGenerationTimeMs, countGenerationTime),
      avgKnowledgeScore: avg(sumKnowledgeScore, countKnowledgeScore),
      hitRate:
        knowledgeRetrievals > 0 ? knowledgeHits / knowledgeRetrievals : null,
      missRate:
        knowledgeRetrievals > 0 ? knowledgeMisses / knowledgeRetrievals : null,
      handoffRate:
        totalInteractions > 0 ? handoffs / totalInteractions : null,
      failureRate:
        totalInteractions > 0 ? failures / totalInteractions : null
    },
    providerUsage,
    modelUsage,
    estimatedCost: estimateCostFromMetadata(rows),
    days: rows.length
  };
}
