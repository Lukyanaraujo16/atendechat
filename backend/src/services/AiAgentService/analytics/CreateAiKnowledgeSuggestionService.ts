import AppError from "../../../errors/AppError";
import AiKnowledgeSuggestion from "../../../models/AiKnowledgeSuggestion";
import { AI_ANALYTICS_PREVIEW_MAX_CHARS } from "../../../config/aiAgentAnalyticsConstants";
import { previewText } from "./analyticsHelpers";

export default async function CreateAiKnowledgeSuggestionService(input: {
  companyId: number;
  aiAgentId?: number | null;
  ticketId?: number | null;
  runtimeLogId?: number | null;
  knowledgeGapId?: number | null;
  origin?: string;
  questionPreview?: string | null;
  aiReplyPreview?: string | null;
  humanReplyPreview?: string | null;
  differenceSummary?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: number | null;
}) {
  const questionPreview = input.questionPreview
    ? previewText(input.questionPreview, AI_ANALYTICS_PREVIEW_MAX_CHARS)
    : null;

  if (!questionPreview && !input.differenceSummary && !input.reason) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Informe ao menos pergunta, diferença ou motivo."
    );
  }

  return AiKnowledgeSuggestion.create({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId ?? null,
    ticketId: input.ticketId ?? null,
    runtimeLogId: input.runtimeLogId ?? null,
    knowledgeGapId: input.knowledgeGapId ?? null,
    origin: input.origin || "manual",
    status: "pending",
    questionPreview,
    aiReplyPreview: input.aiReplyPreview
      ? previewText(input.aiReplyPreview, 2000)
      : null,
    humanReplyPreview: input.humanReplyPreview
      ? previewText(input.humanReplyPreview, 2000)
      : null,
    differenceSummary: input.differenceSummary
      ? previewText(input.differenceSummary, 2000)
      : null,
    reason: input.reason ? String(input.reason).slice(0, 120) : null,
    metadata: {
      ...(input.metadata || {}),
      createdBy: input.createdBy ?? null,
      manual: true
    },
    reviewedBy: null,
    reviewedAt: null
  });
}
