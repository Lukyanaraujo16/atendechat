import { logger } from "../../../utils/logger";
import AiKnowledgeGap from "../../../models/AiKnowledgeGap";
import AiKnowledgeSuggestion from "../../../models/AiKnowledgeSuggestion";
import {
  AI_ANALYTICS_FAQ_SUGGESTION_MIN_FREQUENCY,
  AI_ANALYTICS_PREVIEW_MAX_CHARS
} from "../../../config/aiAgentAnalyticsConstants";
import { hashQuestion, previewText } from "./analyticsHelpers";

export type RecordKnowledgeGapInput = {
  companyId: number;
  aiAgentId: number;
  channel: string;
  question: string;
  knowledgeStatus: string;
  reason: string;
  ticketId?: number | null;
  simulationId?: number | null;
  metadata?: Record<string, unknown> | null;
};

async function maybeCreateFaqSuggestion(gap: AiKnowledgeGap): Promise<void> {
  if (Number(gap.frequency) < AI_ANALYTICS_FAQ_SUGGESTION_MIN_FREQUENCY) {
    return;
  }

  const existing = await AiKnowledgeSuggestion.findOne({
    where: {
      companyId: gap.companyId,
      knowledgeGapId: gap.id,
      origin: "knowledge_gap_faq",
      status: "pending"
    }
  });
  if (existing) return;

  await AiKnowledgeSuggestion.create({
    companyId: gap.companyId,
    aiAgentId: gap.aiAgentId,
    ticketId: gap.ticketId,
    runtimeLogId: null,
    knowledgeGapId: gap.id,
    origin: "knowledge_gap_faq",
    status: "pending",
    questionPreview: gap.questionPreview,
    aiReplyPreview: null,
    humanReplyPreview: null,
    differenceSummary: `Gap recorrente (${gap.frequency}x): considerar FAQ.`,
    reason: gap.reason,
    metadata: {
      questionHash: gap.questionHash,
      frequency: gap.frequency,
      autoSuggested: true
    },
    reviewedBy: null,
    reviewedAt: null
  });
}

async function recordKnowledgeGap(
  input: RecordKnowledgeGapInput
): Promise<AiKnowledgeGap | null> {
  const questionHash = hashQuestion(input.question);
  const questionPreview = previewText(
    input.question,
    AI_ANALYTICS_PREVIEW_MAX_CHARS
  );
  const now = new Date();

  const existing = await AiKnowledgeGap.findOne({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      questionHash,
      reason: input.reason
    }
  });

  if (existing) {
    await existing.update({
      frequency: Number(existing.frequency || 0) + 1,
      lastSeenAt: now,
      knowledgeStatus: input.knowledgeStatus || existing.knowledgeStatus,
      channel: input.channel || existing.channel,
      ticketId: input.ticketId ?? existing.ticketId,
      simulationId: input.simulationId ?? existing.simulationId,
      metadata: input.metadata ?? existing.metadata,
      questionPreview: questionPreview || existing.questionPreview
    });
    await maybeCreateFaqSuggestion(existing);
    return existing;
  }

  const created = await AiKnowledgeGap.create({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    ticketId: input.ticketId ?? null,
    simulationId: input.simulationId ?? null,
    channel: String(input.channel || "unknown").slice(0, 32),
    questionPreview,
    questionHash,
    knowledgeStatus: String(input.knowledgeStatus || "missing").slice(0, 32),
    reason: String(input.reason || "empty_retrieval").slice(0, 64),
    frequency: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    resolved: false,
    resolutionStatus: "open",
    resolvedDocumentId: null,
    resolvedAt: null,
    resolvedBy: null,
    metadata: input.metadata ?? null
  });

  await maybeCreateFaqSuggestion(created);
  return created;
}

export async function safeRecordKnowledgeGap(
  input: RecordKnowledgeGapInput
): Promise<AiKnowledgeGap | null> {
  try {
    return await recordKnowledgeGap(input);
  } catch (err) {
    logger.warn(
      { err, companyId: input.companyId, aiAgentId: input.aiAgentId },
      "safeRecordKnowledgeGap failed"
    );
    return null;
  }
}

export default recordKnowledgeGap;
