import { getLearningConfig } from "../LearningConfig";
import { LearningDataQuality, LearningEvidence } from "../types";

/**
 * LearningDataQualityEvaluator — determinístico.
 */
export function evaluateLearningDataQuality(input: {
  companyId: number;
  sampleSize: number;
  evidence: LearningEvidence[];
  successCount: number;
  failureCount: number;
  partialCount: number;
  humanInterventionCount: number;
  uniqueCapabilities: number;
  uniqueSessions: number;
}): LearningDataQuality {
  const cfg = getLearningConfig(input.companyId);
  const w = cfg.qualityWeights;
  const issues: string[] = [];
  const warnings: string[] = [];

  const sampleScore = Math.min(1, input.sampleSize / Math.max(cfg.minimumSampleSize * 2, 1));
  if (input.sampleSize < cfg.minimumSampleSize) {
    issues.push("insufficient_sample_size");
  }

  const known = input.successCount + input.failureCount + input.partialCount;
  const knownScore = input.sampleSize ? known / input.sampleSize : 0;
  if (knownScore < 0.5) warnings.push("many_unknown_outcomes");

  const completeness =
    input.evidence.length === 0
      ? 0
      : Math.min(1, input.evidence.filter(e => e.sanitized && e.tenantVerified).length / input.evidence.length);

  const consistency =
    input.sampleSize <= 1
      ? 0.3
      : 1 - Math.abs(input.successCount - input.failureCount) / Math.max(input.sampleSize, 1) * 0.2;

  const diversity = Math.min(
    1,
    (input.uniqueCapabilities + input.uniqueSessions) / Math.max(input.sampleSize, 1)
  );
  if (input.uniqueSessions <= 1 && input.sampleSize >= cfg.minimumSampleSize) {
    warnings.push("single_session_bias");
  }

  const recency = 0.8;
  const humanScore = input.humanInterventionCount > 0 || input.sampleSize >= cfg.minimumSampleSize
    ? Math.min(1, input.humanInterventionCount / Math.max(cfg.minimumHumanFeedbackCount || 1, 1))
    : 0.5;

  const tenantIsolation = input.evidence.every(e => e.tenantVerified) ? 1 : 0;
  if (tenantIsolation < 1) issues.push("tenant_verification_failed");

  const score =
    sampleScore * w.sampleSize +
    completeness * w.completeness +
    consistency * w.consistency +
    diversity * w.diversity +
    recency * w.recency +
    knownScore * w.knownOutcomes +
    humanScore * w.humanReview +
    tenantIsolation * w.tenantIsolation;

  let level: LearningDataQuality["level"] = "INSUFFICIENT";
  if (input.sampleSize < cfg.minimumSampleSize) {
    level = "INSUFFICIENT";
  } else if (score >= 0.75) level = "HIGH";
  else if (score >= 0.55) level = "MEDIUM";
  else if (score >= cfg.minimumDataQuality) level = "LOW";
  else level = "INSUFFICIENT";

  return {
    level,
    score: Number(score.toFixed(4)),
    issues,
    warnings,
    usableForPromotion: level === "MEDIUM" || level === "HIGH"
  };
}

export default { evaluateLearningDataQuality };
