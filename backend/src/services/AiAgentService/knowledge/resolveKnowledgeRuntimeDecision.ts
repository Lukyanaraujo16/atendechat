import type { KnowledgeRetrievalResult } from "./knowledgeRetrievalTypes";

/**
 * Decisão única de saída após retrieval (ou falha).
 *
 * Precedência quando knowledgeMissing / falha técnica:
 * 1. handoffWhenKnowledgeMissing → handoff (obrigatório transferir)
 * 2. !allowAnswerWithoutKnowledge → ask_clarification (não inventar)
 * 3. allowAnswerWithoutKnowledge → answer_without_knowledge (fail-open seguro)
 *
 * Com conhecimento relevante → answer_with_knowledge.
 */
export type KnowledgeRuntimeDecision =
  | "answer_with_knowledge"
  | "answer_without_knowledge"
  | "ask_clarification"
  | "handoff"
  | "skip"
  | "fail";

export type KnowledgeRuntimeDecisionResult = {
  decision: KnowledgeRuntimeDecision;
  forceHandoff: boolean;
  knowledgeBlocked: boolean;
  injectKnowledgeContext: boolean;
  reason: string;
};

export function resolveKnowledgeRuntimeDecision(
  retrieval: KnowledgeRetrievalResult | null | undefined
): KnowledgeRuntimeDecisionResult {
  if (!retrieval) {
    return {
      decision: "skip",
      forceHandoff: false,
      knowledgeBlocked: false,
      injectKnowledgeContext: false,
      reason: "no_retrieval"
    };
  }

  if (retrieval.status === "skipped" || !retrieval.enabled) {
    return {
      decision: "skip",
      forceHandoff: false,
      knowledgeBlocked: false,
      injectKnowledgeContext: false,
      reason: retrieval.skippedReason || "skipped"
    };
  }

  const allowWithout = retrieval.allowAnswerWithoutKnowledge !== false;
  const handoffMissing = Boolean(retrieval.suggestHandoff);
  // suggestHandoff já é knowledgeMissing && handoffWhenKnowledgeMissing no engine;
  // para falha técnica, o caller deve setar suggestHandoff conforme settings.

  if (
    retrieval.status === "completed" &&
    !retrieval.knowledgeMissing &&
    retrieval.contextText
  ) {
    return {
      decision: "answer_with_knowledge",
      forceHandoff: false,
      knowledgeBlocked: false,
      injectKnowledgeContext: true,
      reason: "hits_found"
    };
  }

  // Ausência de conhecimento ou falha de retrieval
  const technicalFail = retrieval.status === "failed";
  const missing =
    retrieval.knowledgeMissing ||
    retrieval.status === "empty" ||
    technicalFail;

  if (!missing) {
    return {
      decision: "answer_without_knowledge",
      forceHandoff: false,
      knowledgeBlocked: false,
      injectKnowledgeContext: false,
      reason: "no_context_block"
    };
  }

  // Precedência explícita: handoff > bloqueio > fail-open
  if (handoffMissing) {
    return {
      decision: "handoff",
      forceHandoff: true,
      knowledgeBlocked: true,
      injectKnowledgeContext: false,
      reason: technicalFail ? "technical_fail_handoff" : "knowledge_missing_handoff"
    };
  }

  if (!allowWithout) {
    return {
      decision: technicalFail ? "fail" : "ask_clarification",
      forceHandoff: false,
      knowledgeBlocked: true,
      injectKnowledgeContext: false,
      reason: technicalFail ? "technical_fail_blocked" : "knowledge_missing_blocked"
    };
  }

  return {
    decision: "answer_without_knowledge",
    forceHandoff: false,
    knowledgeBlocked: false,
    injectKnowledgeContext: false,
    reason: technicalFail ? "technical_fail_open" : "knowledge_missing_allowed"
  };
}
