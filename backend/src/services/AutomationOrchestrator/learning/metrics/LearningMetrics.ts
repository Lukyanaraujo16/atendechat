import { createHash } from "crypto";
import { getLearningConfig } from "../LearningConfig";
import { LearningAuditEntry } from "../types";

type Metrics = {
  analysesStarted: number;
  analysesCompleted: number;
  datasetsCreated: number;
  patternsDetected: number;
  candidatesCreated: number;
  candidatesApproved: number;
  candidatesRejected: number;
  candidatesPromoted: number;
  candidatesRolledBack: number;
  candidatesInvalidated: number;
  shadowApplications: number;
  humanFeedbacks: number;
  conflictsDetected: number;
  confidenceSum: number;
  confidenceCount: number;
  qualitySum: number;
  qualityCount: number;
  evaluationScoreSum: number;
  evaluationScoreCount: number;
  patternsByType: Record<string, number>;
  candidatesByType: Record<string, number>;
  artifactsByType: Record<string, number>;
  learningByAgent: Record<string, number>;
  learningByCapability: Record<string, number>;
};

const metrics: Metrics = blankMetrics();
const audits: LearningAuditEntry[] = [];

function blankMetrics(): Metrics {
  return {
    analysesStarted: 0,
    analysesCompleted: 0,
    datasetsCreated: 0,
    patternsDetected: 0,
    candidatesCreated: 0,
    candidatesApproved: 0,
    candidatesRejected: 0,
    candidatesPromoted: 0,
    candidatesRolledBack: 0,
    candidatesInvalidated: 0,
    shadowApplications: 0,
    humanFeedbacks: 0,
    conflictsDetected: 0,
    confidenceSum: 0,
    confidenceCount: 0,
    qualitySum: 0,
    qualityCount: 0,
    evaluationScoreSum: 0,
    evaluationScoreCount: 0,
    patternsByType: {},
    candidatesByType: {},
    artifactsByType: {},
    learningByAgent: {},
    learningByCapability: {}
  };
}

export function recordLearningMetric(
  key: keyof Metrics | string,
  amount = 1,
  bucket?: { type?: string; agentId?: number | null; capability?: string }
): void {
  if (key in metrics && typeof (metrics as any)[key] === "number") {
    (metrics as any)[key] += amount;
  }
  if (bucket?.type && key === "patternsDetected") {
    metrics.patternsByType[bucket.type] =
      (metrics.patternsByType[bucket.type] || 0) + amount;
  }
  if (bucket?.type && key === "candidatesCreated") {
    metrics.candidatesByType[bucket.type] =
      (metrics.candidatesByType[bucket.type] || 0) + amount;
  }
  if (bucket?.type && key === "candidatesPromoted") {
    metrics.artifactsByType[bucket.type] =
      (metrics.artifactsByType[bucket.type] || 0) + amount;
  }
  if (bucket?.agentId != null) {
    const k = String(bucket.agentId);
    metrics.learningByAgent[k] = (metrics.learningByAgent[k] || 0) + amount;
  }
  if (bucket?.capability) {
    metrics.learningByCapability[bucket.capability] =
      (metrics.learningByCapability[bucket.capability] || 0) + amount;
  }
}

export function recordLearningConfidence(value: number): void {
  metrics.confidenceSum += value;
  metrics.confidenceCount += 1;
}

export function recordLearningQuality(value: number): void {
  metrics.qualitySum += value;
  metrics.qualityCount += 1;
}

export function recordEvaluationScore(value: number): void {
  metrics.evaluationScoreSum += value;
  metrics.evaluationScoreCount += 1;
}

export function recordLearningAudit(
  entry: Omit<LearningAuditEntry, "id">
): LearningAuditEntry {
  const cfg = getLearningConfig(entry.companyId);
  const full: LearningAuditEntry = {
    ...entry,
    id: `laud_${createHash("sha256")
      .update(`${entry.companyId}:${entry.action}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    evidenceSummary: String(entry.evidenceSummary || "").slice(
      0,
      cfg.auditPayloadLimit
    )
  };
  audits.unshift(full);
  if (audits.length > 2000) audits.length = 2000;
  return full;
}

export function listLearningAudits(
  companyId: number,
  limit = 50
): LearningAuditEntry[] {
  return audits.filter(a => a.companyId === companyId).slice(0, limit);
}

export function getLearningMetricsBase(): Metrics & {
  averageCandidateConfidence: number;
  averageDataQuality: number;
  averageEvaluationScore: number;
  promotionRate: number;
  rollbackRate: number;
} {
  return {
    ...metrics,
    averageCandidateConfidence: metrics.confidenceCount
      ? metrics.confidenceSum / metrics.confidenceCount
      : 0,
    averageDataQuality: metrics.qualityCount
      ? metrics.qualitySum / metrics.qualityCount
      : 0,
    averageEvaluationScore: metrics.evaluationScoreCount
      ? metrics.evaluationScoreSum / metrics.evaluationScoreCount
      : 0,
    promotionRate: metrics.candidatesCreated
      ? metrics.candidatesPromoted / metrics.candidatesCreated
      : 0,
    rollbackRate: metrics.candidatesPromoted
      ? metrics.candidatesRolledBack / metrics.candidatesPromoted
      : 0
  };
}

export function __resetLearningMetricsForTests(): void {
  Object.assign(metrics, blankMetrics());
  audits.length = 0;
}

export default {
  recordLearningMetric,
  recordLearningAudit,
  getLearningMetricsBase
};
