import { createHash } from "crypto";
import { getLearningConfig } from "../LearningConfig";
import {
  LearningCandidate,
  LearningEvaluationReport
} from "../types";

/**
 * LearningEvaluationEngine — determinístico.
 */
export function evaluateLearningCandidate(input: {
  companyId: number;
  candidate: LearningCandidate;
  conflicts?: string[];
}): LearningEvaluationReport {
  const cfg = getLearningConfig(input.companyId);
  const c = input.candidate;
  const warnings: string[] = [];
  const reasonCodes: string[] = [];
  const conflicts = input.conflicts || [];

  const qualityMap = {
    INSUFFICIENT: 0.2,
    LOW: 0.45,
    MEDIUM: 0.7,
    HIGH: 0.9
  } as const;
  const qualityScore = qualityMap[c.dataQuality] || 0.3;
  const confidenceScore = c.confidence;
  const riskScore = c.risk;
  const impactScore = c.impact;
  const reversibilityScore = c.reversibility;
  const evidenceScore = Math.min(1, c.evidenceIds.length / 5 + c.sampleSize / 10);

  if (c.sampleSize < cfg.minimumSampleSize) {
    reasonCodes.push("insufficient_sample");
  }
  if (qualityScore < cfg.minimumDataQuality) {
    reasonCodes.push("low_data_quality");
  }
  if (confidenceScore < cfg.minimumConfidence) {
    reasonCodes.push("low_confidence");
  }
  if (conflicts.length) {
    reasonCodes.push("conflicts_detected");
    warnings.push(...conflicts);
  }
  if (c.candidateType === "POLICY_RECOMMENDATION") {
    warnings.push("cannot_change_real_policy");
    reasonCodes.push("policy_recommendation_observe_only");
  }

  const requiredApprovals: string[] = [];
  let decision: LearningEvaluationReport["decision"] = "READY_FOR_REVIEW";

  if (
    reasonCodes.includes("insufficient_sample") ||
    c.dataQuality === "INSUFFICIENT"
  ) {
    decision = "INSUFFICIENT_DATA";
  } else if (reasonCodes.includes("low_confidence") && c.sampleSize < cfg.minimumSampleSize * 2) {
    decision = "REQUIRES_MORE_OBSERVATION";
  } else if (riskScore >= cfg.riskThresholds.high || c.candidateType === "POLICY_RECOMMENDATION") {
    decision = "REQUIRES_SUPERADMIN_APPROVAL";
    requiredApprovals.push("superadmin");
  } else if (
    cfg.humanApprovalRequired ||
    riskScore >= cfg.riskThresholds.medium
  ) {
    decision = "REQUIRES_ADMIN_APPROVAL";
    requiredApprovals.push("admin");
  } else if (cfg.shadowEnabled && riskScore <= cfg.riskThresholds.low) {
    decision = "SAFE_FOR_SHADOW";
    requiredApprovals.push("admin_shadow");
  } else {
    decision = "READY_FOR_REVIEW";
    requiredApprovals.push("admin");
  }

  // Never auto-approve even if SAFE_FOR_SHADOW
  if (!cfg.autoPromotionEnabled && decision === "SAFE_FOR_SHADOW") {
    warnings.push("auto_promotion_disabled_requires_explicit_approve");
  }

  const recommendedAction =
    decision === "INSUFFICIENT_DATA"
      ? "collect_more_samples"
      : decision === "REQUIRES_MORE_OBSERVATION"
        ? "continue_observation"
        : decision === "REQUIRES_SUPERADMIN_APPROVAL"
          ? "await_superadmin"
          : "await_admin_review_then_shadow_promote";

  return {
    id: `leva_${createHash("sha256")
      .update(`${c.id}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    candidateId: c.id,
    decision,
    qualityScore,
    confidenceScore,
    riskScore,
    impactScore,
    reversibilityScore,
    evidenceScore,
    conflicts,
    warnings,
    reasonCodes,
    requiredApprovals,
    recommendedAction,
    createdAt: new Date().toISOString(),
    metadata: {
      autoPromotionEnabled: false,
      productionPromotionEnabled: false
    }
  };
}

export default { evaluateLearningCandidate };
