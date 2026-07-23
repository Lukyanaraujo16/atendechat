import { getLearningConfig } from "../LearningConfig";
import { candidateFingerprint } from "./LearningCandidateBuilder";
import { LearningCandidate } from "../types";

/**
 * LearningDeduplicationService — atualiza candidato existente na janela.
 */
export function deduplicateLearningCandidates(input: {
  companyId: number;
  existing: LearningCandidate[];
  incoming: LearningCandidate[];
}): { created: LearningCandidate[]; updated: LearningCandidate[] } {
  const cfg = getLearningConfig(input.companyId);
  const windowMs = cfg.deduplicationWindowDays * 86400000;
  const now = Date.now();
  const created: LearningCandidate[] = [];
  const updated: LearningCandidate[] = [];

  const active = input.existing.filter(c => {
    const age = now - new Date(c.createdAt).getTime();
    return (
      age <= windowMs &&
      !["REJECTED", "INVALIDATED", "EXPIRED", "ROLLED_BACK"].includes(c.status)
    );
  });

  for (const cand of input.incoming) {
    const fp = candidateFingerprint(cand);
    const match = active.find(e => candidateFingerprint(e) === fp);
    if (!match) {
      created.push(cand);
      continue;
    }
    const merged: LearningCandidate = {
      ...match,
      evidenceIds: [...new Set([...match.evidenceIds, ...cand.evidenceIds])],
      patternIds: [...new Set([...match.patternIds, ...cand.patternIds])],
      sampleSize: Math.max(match.sampleSize, cand.sampleSize),
      confidence: Math.max(match.confidence, cand.confidence),
      version: match.version + 1,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...match.metadata,
        lastDedupAt: new Date().toISOString(),
        mergedFrom: cand.id
      }
    };
    updated.push(merged);
  }

  return { created, updated };
}

export default { deduplicateLearningCandidates };
