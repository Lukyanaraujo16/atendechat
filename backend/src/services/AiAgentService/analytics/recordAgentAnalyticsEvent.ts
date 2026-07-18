import { logger } from "../../../utils/logger";
import AiAgentAnalyticsDaily from "../../../models/AiAgentAnalyticsDaily";
import { bumpCounterMap, dayKey } from "./analyticsHelpers";

export type AgentAnalyticsEvent = {
  companyId: number;
  aiAgentId: number;
  channel?: "simulator" | "shadow" | "live" | "test" | string;
  kind?: "interaction" | "retrieval" | "generation";
  knowledgeHit?: boolean;
  knowledgeMiss?: boolean;
  handoff?: boolean;
  clarification?: boolean;
  failure?: boolean;
  responseTimeMs?: number;
  retrievalTimeMs?: number;
  embeddingTimeMs?: number;
  generationTimeMs?: number;
  knowledgeScore?: number;
  chunks?: number;
  contextTokens?: number;
  tokensInput?: number;
  tokensOutput?: number;
  provider?: string | null;
  model?: string | null;
};

async function recordAgentAnalyticsEvent(
  event: AgentAnalyticsEvent
): Promise<void> {
  const day = dayKey();
  const [row] = await AiAgentAnalyticsDaily.findOrCreate({
    where: {
      companyId: event.companyId,
      aiAgentId: event.aiAgentId,
      day
    },
    defaults: {
      companyId: event.companyId,
      aiAgentId: event.aiAgentId,
      day,
      providerUsage: {},
      modelUsage: {},
      metadata: null
    }
  });

  const patch: Record<string, unknown> = {};

  const kind = event.kind || "interaction";
  if (kind === "interaction" || kind === "generation") {
    patch.totalInteractions = Number(row.totalInteractions || 0) + 1;
  }

  const channel = String(event.channel || "").toLowerCase();
  if (channel === "simulator" || channel === "test") {
    patch.simulatorExecutions = Number(row.simulatorExecutions || 0) + 1;
  } else if (channel === "shadow") {
    patch.shadowSuggestions = Number(row.shadowSuggestions || 0) + 1;
  } else if (channel === "live") {
    patch.liveResponses = Number(row.liveResponses || 0) + 1;
  }

  if (kind === "retrieval" || event.knowledgeHit || event.knowledgeMiss) {
    patch.knowledgeRetrievals = Number(row.knowledgeRetrievals || 0) + 1;
  }
  if (event.knowledgeHit) {
    patch.knowledgeHits = Number(row.knowledgeHits || 0) + 1;
  }
  if (event.knowledgeMiss) {
    patch.knowledgeMisses = Number(row.knowledgeMisses || 0) + 1;
  }
  if (event.handoff) {
    patch.handoffs = Number(row.handoffs || 0) + 1;
  }
  if (event.clarification) {
    patch.clarificationRequests = Number(row.clarificationRequests || 0) + 1;
  }
  if (event.failure) {
    patch.failures = Number(row.failures || 0) + 1;
  }

  if (
    event.responseTimeMs != null &&
    Number.isFinite(Number(event.responseTimeMs))
  ) {
    patch.sumResponseTimeMs =
      Number(row.sumResponseTimeMs || 0) + Number(event.responseTimeMs);
    patch.countResponseTime = Number(row.countResponseTime || 0) + 1;
  }
  if (
    event.retrievalTimeMs != null &&
    Number.isFinite(Number(event.retrievalTimeMs))
  ) {
    patch.sumRetrievalTimeMs =
      Number(row.sumRetrievalTimeMs || 0) + Number(event.retrievalTimeMs);
    patch.countRetrievalTime = Number(row.countRetrievalTime || 0) + 1;
  }
  if (
    event.embeddingTimeMs != null &&
    Number.isFinite(Number(event.embeddingTimeMs))
  ) {
    patch.sumEmbeddingTimeMs =
      Number(row.sumEmbeddingTimeMs || 0) + Number(event.embeddingTimeMs);
    patch.countEmbeddingTime = Number(row.countEmbeddingTime || 0) + 1;
  }
  if (
    event.generationTimeMs != null &&
    Number.isFinite(Number(event.generationTimeMs))
  ) {
    patch.sumGenerationTimeMs =
      Number(row.sumGenerationTimeMs || 0) + Number(event.generationTimeMs);
    patch.countGenerationTime = Number(row.countGenerationTime || 0) + 1;
  }

  if (
    event.knowledgeScore != null &&
    Number.isFinite(Number(event.knowledgeScore))
  ) {
    patch.sumKnowledgeScore =
      Number(row.sumKnowledgeScore || 0) + Number(event.knowledgeScore);
    patch.countKnowledgeScore = Number(row.countKnowledgeScore || 0) + 1;
  }
  if (event.chunks != null && Number.isFinite(Number(event.chunks))) {
    patch.sumChunks = Number(row.sumChunks || 0) + Number(event.chunks);
  }
  if (
    event.contextTokens != null &&
    Number.isFinite(Number(event.contextTokens))
  ) {
    patch.sumContextTokens =
      Number(row.sumContextTokens || 0) + Number(event.contextTokens);
  }
  if (
    event.tokensInput != null &&
    Number.isFinite(Number(event.tokensInput))
  ) {
    patch.estimatedTokensInput =
      Number(row.estimatedTokensInput || 0) + Number(event.tokensInput);
  }
  if (
    event.tokensOutput != null &&
    Number.isFinite(Number(event.tokensOutput))
  ) {
    patch.estimatedTokensOutput =
      Number(row.estimatedTokensOutput || 0) + Number(event.tokensOutput);
  }

  if (event.provider) {
    patch.providerUsage = bumpCounterMap(row.providerUsage, event.provider);
  }
  if (event.model) {
    patch.modelUsage = bumpCounterMap(row.modelUsage, event.model);
  }

  if (Object.keys(patch).length > 0) {
    await row.update(patch);
  }
}

export async function safeRecordAgentAnalyticsEvent(
  event: AgentAnalyticsEvent
): Promise<void> {
  try {
    await recordAgentAnalyticsEvent(event);
  } catch (err) {
    logger.warn(
      { err, companyId: event.companyId, aiAgentId: event.aiAgentId },
      "safeRecordAgentAnalyticsEvent failed"
    );
  }
}

export default recordAgentAnalyticsEvent;
