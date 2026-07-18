import { logger } from "../../../utils/logger";
import type { KnowledgeRetrievalResult } from "../knowledge/knowledgeRetrievalTypes";
import type { KnowledgeRuntimeDecisionResult } from "../knowledge/resolveKnowledgeRuntimeDecision";
import { safeRecordAnalyticsFromRetrieval } from "./recordAnalyticsFromRetrieval";
import { safeRecordAgentAnalyticsEvent } from "./recordAgentAnalyticsEvent";
import { safeUpsertExecutionReplay } from "./upsertExecutionReplay";

/**
 * Emite observabilidade pós-retrieval/geração sem afetar o fluxo principal.
 */
export async function safeEmitKnowledgeObservability(input: {
  companyId: number;
  aiAgentId: number;
  channel: string;
  query: string;
  retrieval: KnowledgeRetrievalResult | null | undefined;
  decision?: KnowledgeRuntimeDecisionResult | null;
  ticketId?: number | null;
  simulationId?: number | null;
  runtimeLogId?: number | null;
  messageId?: string | null;
  requestId?: string | null;
  provider?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  responseText?: string | null;
  systemPrompt?: string | null;
  historySummary?: unknown;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  interaction?: boolean;
}): Promise<void> {
  try {
    if (input.retrieval) {
      await safeRecordAnalyticsFromRetrieval({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel: input.channel,
        query: input.query,
        retrieval: input.retrieval,
        decision: input.decision?.decision,
        ticketId: input.ticketId,
        simulationId: input.simulationId
      });
    }

    if (input.interaction) {
      await safeRecordAgentAnalyticsEvent({
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel: input.channel,
        kind: "interaction",
        handoff: Boolean(input.decision?.forceHandoff),
        clarification: input.decision?.decision === "ask_clarification",
        responseTimeMs: input.latencyMs ?? undefined,
        generationTimeMs: input.latencyMs ?? undefined,
        tokensInput: input.tokensInput ?? undefined,
        tokensOutput: input.tokensOutput ?? undefined,
        provider: input.provider,
        model: input.model
      });
    }

    const requestId =
      input.requestId ||
      (input.retrieval?.retrievalId
        ? `retrieval-${input.retrieval.retrievalId}`
        : null);

    await safeUpsertExecutionReplay({
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      channel: input.channel,
      ticketId: input.ticketId,
      messageId: input.messageId,
      runtimeLogId: input.runtimeLogId,
      retrievalId: input.retrieval?.retrievalId ?? null,
      simulationSessionId: input.simulationId,
      requestId,
      decision: input.decision?.decision ?? null,
      handoff: Boolean(input.decision?.forceHandoff),
      provider: input.provider,
      model: input.model,
      latencyMs: input.latencyMs,
      messagePreview: input.query,
      responsePreview: input.responseText,
      snapshot: {
        message: input.query,
        historySummary: input.historySummary ?? null,
        queryUsed: input.retrieval?.queryUsed ?? null,
        chunks: (input.retrieval?.sources || []).slice(0, 20).map(s => ({
          chunkId: s.chunkId,
          documentId: s.documentId,
          knowledgeBaseId: s.knowledgeBaseId,
          score: s.similarityScore,
          sectionTitle: s.sectionTitle,
          documentTitle: s.documentTitle
        })),
        scores: (input.retrieval?.sources || [])
          .slice(0, 20)
          .map(s => s.similarityScore),
        contextText: input.retrieval?.contextText || "",
        systemPrompt: input.systemPrompt || "",
        provider: input.provider,
        model: input.model,
        response: input.responseText || "",
        latencyMs: input.latencyMs,
        decision: input.decision?.decision ?? null,
        decisionReason: input.decision?.reason ?? null,
        handoff: Boolean(input.decision?.forceHandoff),
        retrievalStatus: input.retrieval?.status ?? null,
        metrics: input.retrieval?.metrics ?? null
      }
    });
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        aiAgentId: input.aiAgentId,
        channel: input.channel
      },
      "safeEmitKnowledgeObservability failed"
    );
  }
}
