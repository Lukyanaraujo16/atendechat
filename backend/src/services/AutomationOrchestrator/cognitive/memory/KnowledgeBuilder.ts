import { createHash } from "crypto";
import { getCognitiveMemoryConfig } from "./CognitiveMemoryConfig";
import { ExecutionFeedback } from "../feedback/feedbackTypes";
import { KnowledgeObject } from "./memoryTypes";
import { MemoryType } from "../../../../config/automationCognitiveMemoryConstants";

export type KnowledgeBuilderInput = {
  tenantId: number;
  feedback: ExecutionFeedback;
  agentId?: number | null;
  ticketId?: number | null;
  contactId?: number | null;
  goalId?: string | null;
  executionId?: string | null;
};

function newId(seed: string): string {
  return `ko_${createHash("sha256")
    .update(`${seed}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 14)}`;
}

function importanceFromFeedback(
  tenantId: number,
  feedback: ExecutionFeedback
): number {
  const cfg = getCognitiveMemoryConfig(tenantId).importance;
  if (feedback.replanRequired) return cfg.fromReplan;
  if (feedback.recoveryDecision !== "NONE") return cfg.fromRecovery;
  if (feedback.stepStatus === "FAILED" || feedback.stepStatus === "ABORTED") {
    return cfg.fromFailure;
  }
  if (feedback.stepStatus === "SUCCESS") return cfg.fromSuccess;
  return cfg.default;
}

/**
 * KnowledgeBuilder — Feedback → Knowledge Objects (5 tipos).
 * Determinístico. Sem IA / Provider.
 */
export function buildKnowledgeFromFeedback(
  input: KnowledgeBuilderInput
): KnowledgeObject[] {
  const now = new Date().toISOString();
  const { feedback, tenantId } = input;
  const importance = importanceFromFeedback(tenantId, feedback);
  const base = {
    tenantId,
    agentId: input.agentId ?? null,
    ticketId: input.ticketId ?? null,
    contactId: input.contactId ?? null,
    goalId: input.goalId ?? null,
    executionId: input.executionId || feedback.sessionId,
    confidence: feedback.confidence,
    importance,
    source: "execution_feedback" as const,
    version: 1,
    createdAt: now,
    updatedAt: now,
    entities: feedback.knowledge.entitiesFound,
    metadata: {
      feedbackId: feedback.feedbackId,
      stepStatus: feedback.stepStatus,
      nextDecision: feedback.nextDecision,
      recoveryDecision: feedback.recoveryDecision,
      usesEmbeddings: false,
      vectorIndexed: false
    }
  };

  const objects: KnowledgeObject[] = [];

  // Working — sessão atual / progresso
  objects.push({
    ...base,
    id: newId(`${tenantId}:working:${feedback.feedbackId}`),
    memoryType: "WORKING",
    title: `Working: session ${feedback.sessionId}`,
    summary: feedback.summary,
    content: JSON.stringify({
      goalProgress: feedback.goalProgress,
      executionState: feedback.executionState,
      nextDecision: feedback.nextDecision
    }),
    tags: ["working", "session", feedback.stepStatus.toLowerCase()],
    metadata: {
      ...base.metadata,
      persistent: false,
      ttlHint: "working"
    }
  });

  // Episodic — evento de execução
  objects.push({
    ...base,
    id: newId(`${tenantId}:episodic:${feedback.feedbackId}`),
    memoryType: "EPISODIC",
    title: `Episode: ${feedback.stepStatus} on ${feedback.actionId}`,
    summary: feedback.summary,
    content: JSON.stringify({
      actionId: feedback.actionId,
      runtimeRequestId: feedback.runtimeRequestId,
      runtimeResultId: feedback.runtimeResultId,
      stepStatus: feedback.stepStatus,
      humanIntervention: feedback.humanIntervention
    }),
    tags: ["episodic", "execution", feedback.stepStatus.toLowerCase()]
  });

  // Semantic — conhecimento consolidado de entidades
  if (feedback.knowledge.entitiesFound.length || feedback.knowledge.entitiesMissing.length) {
    objects.push({
      ...base,
      id: newId(`${tenantId}:semantic:${feedback.feedbackId}`),
      memoryType: "SEMANTIC",
      title: "Semantic entities from feedback",
      summary: `Found ${feedback.knowledge.entitiesFound.length}; missing ${feedback.knowledge.entitiesMissing.length}`,
      content: JSON.stringify({
        entitiesFound: feedback.knowledge.entitiesFound,
        entitiesMissing: feedback.knowledge.entitiesMissing,
        constraints: feedback.knowledge.constraintsFound
      }),
      tags: ["semantic", "entities"]
    });
  }

  // Procedural — padrões / boas práticas a partir de recovery/next
  objects.push({
    ...base,
    id: newId(`${tenantId}:procedural:${feedback.feedbackId}`),
    memoryType: "PROCEDURAL",
    title: `Procedure: ${feedback.recoveryDecision} → ${feedback.nextDecision}`,
    summary: `When step=${feedback.stepStatus}, recover=${feedback.recoveryDecision}, next=${feedback.nextDecision}`,
    content: JSON.stringify({
      stepStatus: feedback.stepStatus,
      recoveryDecision: feedback.recoveryDecision,
      nextDecision: feedback.nextDecision,
      changesMade: feedback.knowledge.changesMade
    }),
    tags: [
      "procedural",
      feedback.recoveryDecision.toLowerCase(),
      feedback.nextDecision.toLowerCase()
    ]
  });

  // Reflection — lições / falhas
  if (
    feedback.stepStatus === "FAILED" ||
    feedback.stepStatus === "ABORTED" ||
    feedback.replanRequired ||
    feedback.knowledge.errors.length > 0
  ) {
    objects.push({
      ...base,
      id: newId(`${tenantId}:reflection:${feedback.feedbackId}`),
      memoryType: "REFLECTION",
      title: "Reflection: lessons from failure/recovery",
      summary: feedback.summary,
      content: JSON.stringify({
        errors: feedback.knowledge.errors,
        warnings: feedback.knowledge.warnings,
        replanRequired: feedback.replanRequired,
        recoveryDecision: feedback.recoveryDecision
      }),
      tags: ["reflection", "lesson", feedback.stepStatus.toLowerCase()],
      importance: Math.max(importance, 0.7)
    });
  }

  return objects;
}

export function buildMemoryIndex(object: KnowledgeObject) {
  return {
    entity: object.entities[0]?.key || null,
    tenant: object.tenantId,
    agent: object.agentId,
    contact: object.contactId,
    ticket: object.ticketId,
    goal: object.goalId,
    tags: object.tags,
    importance: object.importance,
    confidence: object.confidence,
    memoryId: object.id,
    memoryType: object.memoryType as MemoryType
  };
}

export default { buildKnowledgeFromFeedback, buildMemoryIndex };
