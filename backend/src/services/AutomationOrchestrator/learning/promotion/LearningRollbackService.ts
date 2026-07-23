import { LearningArtifact, LearningCandidate } from "../types";

/**
 * LearningRollbackService — shadow/admin/simulation only.
 */
export function rollbackLearningArtifact(input: {
  artifact: LearningArtifact;
  candidate: LearningCandidate | null;
  reason: string;
  userId?: number | null;
}): {
  artifact: LearningArtifact;
  candidate: LearningCandidate | null;
} {
  if (input.artifact.environment === undefined) {
    throw new Error("ERR_LEARNING_ROLLBACK_FORBIDDEN");
  }
  // production never used; still guard
  if ((input.artifact.metadata as any)?.liveIntegrationEnabled === true) {
    throw new Error("ERR_LEARNING_ROLLBACK_FORBIDDEN_LIVE");
  }
  if (!input.artifact.rollbackAvailable) {
    throw new Error("ERR_LEARNING_ROLLBACK_UNAVAILABLE");
  }

  const now = new Date().toISOString();
  const artifact: LearningArtifact = {
    ...input.artifact,
    status: "ROLLED_BACK",
    rollbackAvailable: false,
    metadata: {
      ...input.artifact.metadata,
      rolledBackAt: now,
      rolledBackBy: input.userId ?? null,
      rollbackReason: input.reason,
      restoredValue: input.artifact.rollbackData?.previousValue ?? null
    }
  };

  const candidate = input.candidate
    ? {
        ...input.candidate,
        status: "ROLLED_BACK" as const,
        updatedAt: now,
        metadata: {
          ...input.candidate.metadata,
          rollbackReason: input.reason
        }
      }
    : null;

  return { artifact, candidate };
}

export default { rollbackLearningArtifact };
