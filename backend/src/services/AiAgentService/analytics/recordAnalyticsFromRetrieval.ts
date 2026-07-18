import { logger } from "../../../utils/logger";
import type { KnowledgeRetrievalResult } from "../knowledge/knowledgeRetrievalTypes";
import { safeRecordAgentAnalyticsEvent } from "./recordAgentAnalyticsEvent";
import { safeRecordDocumentStatsFromSources } from "./recordDocumentStatsFromSources";
import { safeRecordKnowledgeGap } from "./recordKnowledgeGap";

function mapGapReason(input: {
  retrieval: KnowledgeRetrievalResult;
  decision?: string | null;
}): string | null {
  const decision = String(input.decision || "").toLowerCase();
  const status = input.retrieval.status;
  const miss =
    input.retrieval.knowledgeMissing ||
    status === "empty" ||
    (status === "completed" &&
      (!input.retrieval.sources || input.retrieval.sources.length === 0));

  if (!miss && status !== "failed") return null;

  if (decision === "handoff") return "handoff_knowledge_missing";
  if (decision === "ask_clarification") {
    return "ask_clarification_knowledge_missing";
  }
  if (status === "empty" || miss) return "empty_retrieval";
  if (status === "failed") return "empty_retrieval";
  return "below_minimum_score";
}

/**
 * Orquestrador pós-retrieval: analytics diário + stats de docs + gaps.
 * Sempre fail-open.
 */
export async function safeRecordAnalyticsFromRetrieval(input: {
  companyId: number;
  aiAgentId: number;
  channel: string;
  query: string;
  retrieval: KnowledgeRetrievalResult;
  decision?: string | null;
  ticketId?: number | null;
  simulationId?: number | null;
}): Promise<void> {
  try {
    const { retrieval } = input;
    const hasSources =
      Array.isArray(retrieval.sources) && retrieval.sources.length > 0;
    const isHit =
      retrieval.status === "completed" &&
      hasSources &&
      !retrieval.knowledgeMissing;
    const isMiss =
      retrieval.knowledgeMissing ||
      retrieval.status === "empty" ||
      retrieval.status === "failed" ||
      (retrieval.status === "completed" && !hasSources);
    const decision = String(input.decision || "").toLowerCase();

    await safeRecordAgentAnalyticsEvent({
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      channel: input.channel,
      kind: "retrieval",
      knowledgeHit: isHit,
      knowledgeMiss: isMiss,
      handoff: decision === "handoff",
      clarification: decision === "ask_clarification",
      failure: retrieval.status === "failed",
      retrievalTimeMs: retrieval.metrics?.durationMs,
      embeddingTimeMs: retrieval.metrics?.embeddingDurationMs,
      knowledgeScore: hasSources
        ? Number(retrieval.sources[0]?.similarityScore)
        : undefined,
      chunks: retrieval.metrics?.returnedChunkCount,
      contextTokens: retrieval.metrics?.estimatedContextTokens,
      provider: retrieval.metrics?.provider,
      model: retrieval.metrics?.model
    });

    if (hasSources) {
      await safeRecordDocumentStatsFromSources({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        sources: retrieval.sources.map((s, idx) => ({
          documentId: s.documentId,
          knowledgeBaseId: s.knowledgeBaseId,
          score: s.similarityScore,
          rank: idx + 1
        })),
        failed: retrieval.status === "failed"
      });
    }

    const gapReason = mapGapReason({
      retrieval,
      decision: input.decision
    });

    if (
      gapReason &&
      (isMiss ||
        decision === "handoff" ||
        decision === "ask_clarification" ||
        decision === "empty")
    ) {
      await safeRecordKnowledgeGap({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel: input.channel,
        question: input.query || retrieval.queryUsed || "",
        knowledgeStatus: retrieval.status || "empty",
        reason: gapReason,
        ticketId: input.ticketId,
        simulationId: input.simulationId,
        metadata: {
          decision: input.decision ?? null,
          skippedReason: retrieval.skippedReason,
          errorCode: retrieval.errorCode ?? null
        }
      });
    }
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        aiAgentId: input.aiAgentId
      },
      "safeRecordAnalyticsFromRetrieval failed"
    );
  }
}

export default safeRecordAnalyticsFromRetrieval;
