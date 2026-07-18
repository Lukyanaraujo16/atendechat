import { logger } from "../../../utils/logger";
import RetrieveKnowledgeForAgentService from "./RetrieveKnowledgeForAgentService";
import {
  appendKnowledgeContextToSystemPrompt,
  buildKnowledgeRuntimeMetadata
} from "./appendKnowledgeContextToSystemPrompt";
import {
  resolveKnowledgeRuntimeDecision,
  type KnowledgeRuntimeDecisionResult
} from "./resolveKnowledgeRuntimeDecision";
import type { KnowledgeRetrievalResult } from "./knowledgeRetrievalTypes";

/**
 * Executa retrieval com fail-open: erros não derrubam o atendimento/simulação.
 * Em crash, assume allowAnswerWithoutKnowledge=true (fail-open técnico).
 */
export async function safeRetrieveKnowledgeForAgent(
  input: Parameters<typeof RetrieveKnowledgeForAgentService>[0]
): Promise<KnowledgeRetrievalResult | null> {
  try {
    return await RetrieveKnowledgeForAgentService(input);
  } catch (err) {
    logger.warn(
      `[KB-RAG] retrieval falhou (fail-open): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return {
      enabled: true,
      performed: false,
      skippedReason: null,
      status: "failed",
      queryUsed: String(input.query || "").slice(0, 200),
      results: [],
      contextText: "",
      sources: [],
      metrics: {
        durationMs: 0,
        embeddingDurationMs: 0,
        searchDurationMs: 0,
        candidateCount: 0,
        returnedChunkCount: 0,
        returnedDocumentCount: 0,
        estimatedContextTokens: 0,
        contextCharacters: 0,
        provider: "",
        model: "",
        dimensions: 0,
        truncated: false
      },
      errorCode: "ERR_KNOWLEDGE_RETRIEVAL_FAILED",
      errorMessage: "Falha na recuperação de conhecimento.",
      knowledgeMissing: true,
      suggestHandoff: false,
      allowAnswerWithoutKnowledge: true
    };
  }
}

export function applyKnowledgeToSystemPrompt(
  systemPrompt: string,
  retrieval: KnowledgeRetrievalResult | null
): {
  systemPrompt: string;
  knowledgeBlocked: boolean;
  forceHandoff: boolean;
  decision: KnowledgeRuntimeDecisionResult;
} {
  const decision = resolveKnowledgeRuntimeDecision(retrieval);

  if (decision.decision === "skip" || !retrieval) {
    return {
      systemPrompt,
      knowledgeBlocked: false,
      forceHandoff: false,
      decision
    };
  }

  if (decision.injectKnowledgeContext && retrieval.contextText) {
    return {
      systemPrompt: appendKnowledgeContextToSystemPrompt(
        systemPrompt,
        retrieval
      ),
      knowledgeBlocked: false,
      forceHandoff: false,
      decision
    };
  }

  if (decision.decision === "handoff") {
    const blockedPrompt = [
      systemPrompt,
      "",
      "--- Conhecimento insuficiente ---",
      "Não há trechos relevantes na Base de Conhecimento para esta pergunta.",
      "Não invente informações da empresa.",
      "Solicite handoff humano de forma curta e educada e inclua exatamente [HANDOFF_HUMAN] em linha separada.",
      "Não envie resposta longa nem invente políticas/preços."
    ].join("\n");
    return {
      systemPrompt: blockedPrompt,
      knowledgeBlocked: true,
      forceHandoff: true,
      decision
    };
  }

  if (
    decision.decision === "ask_clarification" ||
    decision.decision === "fail"
  ) {
    const blockedPrompt = [
      systemPrompt,
      "",
      "--- Conhecimento insuficiente ---",
      "Não há trechos relevantes na Base de Conhecimento para esta pergunta.",
      "Não invente informações da empresa.",
      "Peça um esclarecimento objetivo ao cliente ou informe educadamente que não possui essa informação.",
      "Não invente preços, prazos ou políticas."
    ].join("\n");
    return {
      systemPrompt: blockedPrompt,
      knowledgeBlocked: true,
      forceHandoff: false,
      decision
    };
  }

  // answer_without_knowledge — prompt original, sem bloco vazio
  return {
    systemPrompt,
    knowledgeBlocked: false,
    forceHandoff: false,
    decision
  };
}

export { buildKnowledgeRuntimeMetadata, resolveKnowledgeRuntimeDecision };
