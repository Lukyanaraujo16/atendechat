import { Op } from "sequelize";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import AiAgentSuggestionReview from "../../models/AiAgentSuggestionReview";
import { AI_AGENT_SHADOW_STATUSES } from "./aiAgentShadowErrors";
import {
  buildShadowSuggestionWhere,
  defaultSummaryDateFrom,
  ShadowSuggestionListFilters
} from "./shadowSuggestionFilters";

export default async function GetAiAgentShadowSuggestionsSummaryService(
  input: ShadowSuggestionListFilters
) {
  const where = buildShadowSuggestionWhere({
    ...input,
    dateFrom: input.dateFrom || defaultSummaryDateFrom().toISOString()
  });

  const rows = await AiAgentRuntimeLog.findAll({
    where,
    attributes: [
      "id",
      "shadowStatus",
      "shadowProvider",
      "totalTokens",
      "latencyMs"
    ],
    raw: true
  });

  let generated = 0;
  let failed = 0;
  let skipped = 0;
  let rateLimited = 0;
  let openai = 0;
  let gemini = 0;
  let tokenSum = 0;
  let tokenCount = 0;
  let latencySum = 0;
  let latencyCount = 0;

  for (const row of rows) {
    const status = String(row.shadowStatus || "");
    if (status === AI_AGENT_SHADOW_STATUSES.GENERATED) generated += 1;
    if (status === AI_AGENT_SHADOW_STATUSES.FAILED) failed += 1;
    if (status === AI_AGENT_SHADOW_STATUSES.SKIPPED) skipped += 1;
    if (status === AI_AGENT_SHADOW_STATUSES.RATE_LIMITED) rateLimited += 1;

    const provider = String(row.shadowProvider || "");
    if (provider === "openai") openai += 1;
    if (provider === "gemini") gemini += 1;

    if (row.totalTokens != null && Number.isFinite(Number(row.totalTokens))) {
      tokenSum += Number(row.totalTokens);
      tokenCount += 1;
    }
    if (row.latencyMs != null && Number.isFinite(Number(row.latencyMs))) {
      latencySum += Number(row.latencyMs);
      latencyCount += 1;
    }
  }

  const logIds = rows.map((row) => row.id);
  let reviewGood = 0;
  let reviewBad = 0;
  let reviewInvented = 0;
  let reviewTotal = 0;

  if (logIds.length > 0) {
    const reviews = await AiAgentSuggestionReview.findAll({
      where: {
        companyId: input.companyId,
        aiAgentRuntimeLogId: { [Op.in]: logIds }
      },
      attributes: ["rating", "tags"],
      raw: true
    });
    reviewTotal = reviews.length;
    for (const review of reviews) {
      if (review.rating === "good") reviewGood += 1;
      if (review.rating === "bad") reviewBad += 1;
      const tags = Array.isArray(review.tags) ? review.tags : [];
      if (tags.includes("invented_information")) reviewInvented += 1;
    }
  }

  const total = rows.length;
  const successRate =
    total > 0 ? Math.round((generated / total) * 1000) / 10 : 0;

  const topProvider =
    openai === gemini
      ? null
      : openai > gemini
        ? "openai"
        : gemini > openai
          ? "gemini"
          : null;

  return {
    total,
    generated,
    failed,
    skipped,
    rateLimited,
    successRate,
    avgTokens: tokenCount > 0 ? Math.round(tokenSum / tokenCount) : null,
    avgLatencyMs:
      latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
    providers: { openai, gemini },
    topProvider,
    reviews: {
      total: reviewTotal,
      good: reviewGood,
      bad: reviewBad,
      inventedInformation: reviewInvented
    }
  };
}
