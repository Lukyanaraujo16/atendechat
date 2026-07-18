import { logger } from "../../../utils/logger";
import AiKnowledgeSuggestion from "../../../models/AiKnowledgeSuggestion";
import { AI_ANALYTICS_PREVIEW_MAX_CHARS } from "../../../config/aiAgentAnalyticsConstants";
import { previewText } from "./analyticsHelpers";

/**
 * Quando review shadow é bad / invented, cria sugestão assistida (nunca documento).
 */
export default async function CreateAiKnowledgeSuggestionFromReviewService(input: {
  companyId: number;
  aiAgentId?: number | null;
  ticketId?: number | null;
  runtimeLogId?: number | null;
  rating?: string | null;
  tags?: string[] | null;
  note?: string | null;
  questionPreview?: string | null;
  aiReplyPreview?: string | null;
  humanReplyPreview?: string | null;
  reviewedBy?: number | null;
}): Promise<AiKnowledgeSuggestion | null> {
  try {
    const rating = String(input.rating || "").toLowerCase();
    const tags = Array.isArray(input.tags)
      ? input.tags.map(t => String(t).toLowerCase())
      : [];
    const invented = tags.includes("invented_information");
    const isBad = rating === "bad";

    if (!isBad && !invented) {
      return null;
    }

    const reason = invented
      ? "shadow_review_invented"
      : "shadow_review_bad";

    const differenceParts: string[] = [];
    if (isBad) differenceParts.push("Review: bad");
    if (invented) differenceParts.push("Tag: invented_information");
    if (input.note) differenceParts.push(`Nota: ${String(input.note).slice(0, 200)}`);

    return await AiKnowledgeSuggestion.create({
      companyId: input.companyId,
      aiAgentId: input.aiAgentId ?? null,
      ticketId: input.ticketId ?? null,
      runtimeLogId: input.runtimeLogId ?? null,
      knowledgeGapId: null,
      origin: "shadow_review",
      status: "pending",
      questionPreview: input.questionPreview
        ? previewText(input.questionPreview, AI_ANALYTICS_PREVIEW_MAX_CHARS)
        : null,
      aiReplyPreview: input.aiReplyPreview
        ? previewText(input.aiReplyPreview, 2000)
        : null,
      humanReplyPreview: input.humanReplyPreview
        ? previewText(input.humanReplyPreview, 2000)
        : input.note
          ? previewText(input.note, 2000)
          : null,
      differenceSummary: differenceParts.join(" | ").slice(0, 2000) || null,
      reason,
      metadata: {
        rating,
        tags,
        fromReview: true
      },
      reviewedBy: null,
      reviewedAt: null
    });
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        runtimeLogId: input.runtimeLogId
      },
      "CreateAiKnowledgeSuggestionFromReviewService failed"
    );
    return null;
  }
}
