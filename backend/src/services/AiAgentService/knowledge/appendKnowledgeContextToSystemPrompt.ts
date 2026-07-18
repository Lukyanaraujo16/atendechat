import {
  KNOWLEDGE_CONTEXT_SAFETY_RULES
} from "../../../config/aiAgentKnowledgeConstants";
import type { KnowledgeRetrievalResult } from "./knowledgeRetrievalTypes";

/**
 * Anexa contexto de conhecimento ao system prompt sem sobrescrever regras de produto.
 */
export function appendKnowledgeContextToSystemPrompt(
  systemPrompt: string,
  retrieval: KnowledgeRetrievalResult | null | undefined
): string {
  if (!retrieval?.performed || !retrieval.contextText) {
    return systemPrompt;
  }
  return [
    systemPrompt,
    "",
    KNOWLEDGE_CONTEXT_SAFETY_RULES,
    "",
    retrieval.contextText
  ].join("\n");
}

export function buildKnowledgeRuntimeMetadata(
  retrieval: KnowledgeRetrievalResult | null | undefined
): Record<string, unknown> | null {
  if (!retrieval) return null;
  return {
    knowledge: {
      enabled: retrieval.enabled,
      performed: retrieval.performed,
      status: retrieval.status,
      skippedReason: retrieval.skippedReason,
      knowledgeMissing: retrieval.knowledgeMissing,
      suggestHandoff: retrieval.suggestHandoff,
      allowAnswerWithoutKnowledge: retrieval.allowAnswerWithoutKnowledge,
      queryUsed: retrieval.queryUsed
        ? retrieval.queryUsed.slice(0, 200)
        : "",
      retrievalId: retrieval.retrievalId ?? null,
      sourceCount: retrieval.sources.length,
      maxScore: retrieval.sources[0]?.similarityScore ?? null,
      sources: retrieval.sources.slice(0, 12).map(s => ({
        knowledgeBaseId: s.knowledgeBaseId,
        knowledgeBaseName: s.knowledgeBaseName,
        documentId: s.documentId,
        documentTitle: s.documentTitle,
        sectionTitle: s.sectionTitle,
        chunkId: s.chunkId,
        similarityScore: s.similarityScore,
        documentType: s.documentType
      })),
      metrics: {
        durationMs: retrieval.metrics.durationMs,
        embeddingDurationMs: retrieval.metrics.embeddingDurationMs,
        searchDurationMs: retrieval.metrics.searchDurationMs,
        candidateCount: retrieval.metrics.candidateCount,
        returnedChunkCount: retrieval.metrics.returnedChunkCount,
        returnedDocumentCount: retrieval.metrics.returnedDocumentCount,
        contextCharacters: retrieval.metrics.contextCharacters,
        estimatedContextTokens: retrieval.metrics.estimatedContextTokens,
        provider: retrieval.metrics.provider,
        model: retrieval.metrics.model,
        dimensions: retrieval.metrics.dimensions,
        truncated: retrieval.metrics.truncated
      },
      errorCode: retrieval.errorCode ?? null
    }
  };
}
