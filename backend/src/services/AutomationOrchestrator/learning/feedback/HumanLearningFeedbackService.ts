import { createHash } from "crypto";
import { HumanFeedbackClassification } from "../../../../config/automationLearningConstants";
import { HumanLearningFeedback } from "../types";

/**
 * Human feedback com peso simples (sem reputação complexa).
 */
export function createHumanLearningFeedback(input: {
  companyId: number;
  userId: number;
  agentId?: number | null;
  sessionId?: string | null;
  executionId?: string | null;
  candidateId?: string | null;
  rating: number;
  classification: HumanFeedbackClassification;
  comment?: string;
  expectedOutcome?: string | null;
  actualOutcome?: string | null;
  approved?: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}): HumanLearningFeedback {
  let weight = 0.5;
  if (input.isAdmin) weight += 0.2;
  if (input.isSuperAdmin) weight += 0.2;
  if (input.candidateId) weight += 0.05;
  if (input.approved) weight += 0.05;
  weight = Math.min(1, weight);

  // UNSAFE feedback weighs more for caution
  if (input.classification === "UNSAFE") weight = Math.min(1, weight + 0.1);
  if (input.classification === "IRRELEVANT") weight = Math.max(0.1, weight - 0.2);

  return {
    id: `lhfb_${createHash("sha256")
      .update(`${input.companyId}:${input.userId}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId: input.companyId,
    userId: input.userId,
    agentId: input.agentId ?? null,
    sessionId: input.sessionId ?? null,
    executionId: input.executionId ?? null,
    candidateId: input.candidateId ?? null,
    rating: Math.max(1, Math.min(5, input.rating)),
    classification: input.classification,
    comment: String(input.comment || "").slice(0, 1000),
    expectedOutcome: input.expectedOutcome ?? null,
    actualOutcome: input.actualOutcome ?? null,
    approved: input.approved === true,
    weight,
    createdAt: new Date().toISOString(),
    metadata: { blindAccept: false }
  };
}

export default { createHumanLearningFeedback };
