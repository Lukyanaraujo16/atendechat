import { LearningCandidate } from "../types";

/**
 * LearningConflictDetector — conflitos tenant-scoped.
 */
export function detectLearningConflicts(input: {
  companyId: number;
  candidate: LearningCandidate;
  others: LearningCandidate[];
}): string[] {
  const conflicts: string[] = [];
  if (input.candidate.companyId !== input.companyId) {
    conflicts.push("tenant_mismatch");
  }

  for (const other of input.others) {
    if (other.companyId !== input.companyId) continue;
    if (other.id === input.candidate.id) continue;
    if (["REJECTED", "INVALIDATED", "EXPIRED", "ROLLED_BACK"].includes(other.status))
      continue;

    if (
      input.candidate.candidateType === "RUNTIME_PREFERENCE" &&
      other.candidateType === "RUNTIME_PREFERENCE" &&
      input.candidate.target === other.target
    ) {
      const a = String(input.candidate.proposedChange.preference || "");
      const b = String(other.proposedChange.preference || "");
      if (a && b && a !== b) {
        conflicts.push(`runtime_preference_conflict:${other.id}`);
      }
    }

    if (
      input.candidate.candidateType === "STRATEGY_PREFERENCE" &&
      other.candidateType === "STRATEGY_PREFERENCE" &&
      input.candidate.target === other.target
    ) {
      const a = JSON.stringify(input.candidate.proposedChange.preferredStrategies || []);
      const b = JSON.stringify(other.proposedChange.preferredStrategies || []);
      if (a !== b) conflicts.push(`strategy_preference_conflict:${other.id}`);
    }

    if (
      input.candidate.candidateType === "POLICY_RECOMMENDATION" &&
      other.status === "APPROVED"
    ) {
      conflicts.push("policy_recommendation_vs_approved_policy_boundary");
    }
  }

  if (input.candidate.metadata?.appliesToLive === true) {
    conflicts.push("live_modification_forbidden");
  }

  return conflicts;
}

export default { detectLearningConflicts };
