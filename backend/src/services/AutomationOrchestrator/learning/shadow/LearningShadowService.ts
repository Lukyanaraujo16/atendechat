import { createHash } from "crypto";
import {
  LearningArtifact,
  LearningCandidate,
  LearningShadowComparison
} from "../types";

/**
 * Shadow Learning — reprocessa decisão em simulação; não altera histórico.
 */
export function runLearningShadowComparison(input: {
  companyId: number;
  candidate: LearningCandidate;
  artifact?: LearningArtifact | null;
  sourceExecutionId: string;
  originalDecision: Record<string, unknown>;
}): LearningShadowComparison {
  const preferred =
    input.candidate.proposedChange.preference ||
    input.candidate.proposedChange.preferredStrategies ||
    input.candidate.proposedChange;

  const shadowDecision: Record<string, unknown> = {
    source: "learning_shadow",
    candidateType: input.candidate.candidateType,
    proposed: preferred,
    environment: "SHADOW",
    appliesToLive: false
  };

  const originalRuntime = String(
    input.originalDecision.runtimeType ||
      input.originalDecision.preference ||
      ""
  );
  const shadowRuntime = String(
    (preferred as any)?.preference ||
      shadowDecision.proposed ||
      ""
  );
  const sameDecision =
    JSON.stringify(input.originalDecision) === JSON.stringify(shadowDecision) ||
    originalRuntime === shadowRuntime;

  return {
    id: `lsh_${createHash("sha256")
      .update(`${input.candidate.id}:${input.sourceExecutionId}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId: input.companyId,
    candidateId: input.candidate.id,
    artifactId: input.artifact?.id || null,
    sourceExecutionId: input.sourceExecutionId,
    originalDecision: input.originalDecision,
    shadowDecision,
    sameDecision,
    expectedImprovement: sameDecision
      ? null
      : input.candidate.expectedBenefit,
    possibleRegression: sameDecision
      ? null
      : input.candidate.possibleRisks[0] || "possible_behavior_change",
    confidence: input.candidate.confidence,
    evaluation: sameDecision ? "NO_CHANGE" : "SHADOW_DIFF",
    createdAt: new Date().toISOString(),
    metadata: {
      historicalExecutionUnchanged: true,
      liveIntegrationEnabled: false
    }
  };
}

export default { runLearningShadowComparison };
