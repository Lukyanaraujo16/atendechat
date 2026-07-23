import { getLearningConfig } from "../LearningConfig";
import { LearningCandidate } from "../types";

export type DecayMark = "OK" | "STALE" | "EXPIRED" | "NEEDS_REVALIDATION";

/**
 * Temporal decay determinístico — não apaga histórico.
 */
export function applyTemporalDecay(input: {
  companyId: number;
  candidate: LearningCandidate;
  now?: Date;
}): { confidence: number; mark: DecayMark; candidate: LearningCandidate } {
  const cfg = getLearningConfig(input.companyId);
  const now = input.now || new Date();
  let confidence = input.candidate.confidence;
  let mark: DecayMark = "OK";

  if (!cfg.temporalDecayEnabled) {
    return { confidence, mark, candidate: input.candidate };
  }

  const created = new Date(input.candidate.createdAt).getTime();
  const days = Math.max(0, (now.getTime() - created) / 86400000);
  confidence = Math.max(0.05, confidence - days * cfg.temporalDecayRate);

  if (input.candidate.expiresAt && now > new Date(input.candidate.expiresAt)) {
    mark = "EXPIRED";
  } else if (days > cfg.candidateExpirationDays * 0.7) {
    mark = "NEEDS_REVALIDATION";
  } else if (days > cfg.candidateExpirationDays * 0.4) {
    mark = "STALE";
  }

  const candidate: LearningCandidate = {
    ...input.candidate,
    confidence,
    status:
      mark === "EXPIRED" && input.candidate.status !== "PROMOTED"
        ? "EXPIRED"
        : input.candidate.status,
    metadata: {
      ...input.candidate.metadata,
      decayMark: mark,
      decayedConfidence: confidence
    },
    updatedAt: now.toISOString()
  };

  return { confidence, mark, candidate };
}

export function invalidateLearningCandidate(
  candidate: LearningCandidate,
  reason: string
): LearningCandidate {
  return {
    ...candidate,
    status: "INVALIDATED",
    updatedAt: new Date().toISOString(),
    metadata: {
      ...candidate.metadata,
      invalidationReason: reason
    }
  };
}

export default { applyTemporalDecay, invalidateLearningCandidate };
