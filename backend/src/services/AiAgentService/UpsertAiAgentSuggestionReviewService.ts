import AppError from "../../errors/AppError";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import AiAgentSuggestionReview from "../../models/AiAgentSuggestionReview";
import {
  AI_AGENT_REVIEW_NOTE_MAX_LENGTH,
  AI_AGENT_REVIEW_RATINGS,
  AI_AGENT_REVIEW_TAGS,
  AiAgentReviewRating,
  AiAgentReviewTag
} from "./aiAgentSuggestionReviewConfig";
import CreateAiKnowledgeSuggestionFromReviewService from "./analytics/CreateAiKnowledgeSuggestionFromReviewService";
import { previewText } from "./analytics/analyticsHelpers";

type ReviewBody = {
  rating?: unknown;
  tags?: unknown;
  note?: unknown;
};

function parseRating(value: unknown): AiAgentReviewRating {
  const rating = String(value || "").trim().toLowerCase();
  if (!(AI_AGENT_REVIEW_RATINGS as readonly string[]).includes(rating)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Avaliação inválida.");
  }
  return rating as AiAgentReviewRating;
}

function parseTags(value: unknown): AiAgentReviewTag[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Tags inválidas.");
  }
  const tags = value
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean);
  for (const tag of tags) {
    if (!(AI_AGENT_REVIEW_TAGS as readonly string[]).includes(tag)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "Tag de avaliação inválida.");
    }
  }
  return [...new Set(tags)] as AiAgentReviewTag[];
}

function parseNote(value: unknown): string | null {
  if (value == null || String(value).trim() === "") return null;
  const note = String(value).trim();
  if (note.length > AI_AGENT_REVIEW_NOTE_MAX_LENGTH) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `Observação deve ter no máximo ${AI_AGENT_REVIEW_NOTE_MAX_LENGTH} caracteres.`
    );
  }
  return note;
}

export default async function UpsertAiAgentSuggestionReviewService(input: {
  companyId: number;
  runtimeLogId: number;
  reviewedBy: number;
  body: ReviewBody;
}) {
  const log = await AiAgentRuntimeLog.findOne({
    where: { id: input.runtimeLogId, companyId: input.companyId }
  });
  if (!log) {
    throw new AppError("ERR_NOT_FOUND", 404, "Registro de shadow não encontrado.");
  }

  const rating = parseRating(input.body.rating);
  const tags = parseTags(input.body.tags);
  const note = parseNote(input.body.note);

  const existing = await AiAgentSuggestionReview.findOne({
    where: {
      companyId: input.companyId,
      aiAgentRuntimeLogId: input.runtimeLogId
    }
  });

  const emitSuggestion = () => {
    void CreateAiKnowledgeSuggestionFromReviewService({
      companyId: input.companyId,
      aiAgentId: log.aiAgentId,
      ticketId: log.ticketId,
      runtimeLogId: input.runtimeLogId,
      rating,
      tags,
      note,
      aiReplyPreview: log.suggestedReply,
      questionPreview: previewText(log.messageId || "", 120),
      reviewedBy: input.reviewedBy
    });
  };

  if (existing) {
    await existing.update({
      rating,
      tags,
      note,
      reviewedBy: input.reviewedBy,
      aiAgentId: log.aiAgentId,
      ticketId: log.ticketId
    });
    emitSuggestion();
    return {
      id: existing.id,
      rating: existing.rating,
      tags: existing.tags || [],
      note: existing.note,
      reviewedBy: existing.reviewedBy,
      reviewedAt: existing.updatedAt
    };
  }

  const created = await AiAgentSuggestionReview.create({
    companyId: input.companyId,
    aiAgentRuntimeLogId: input.runtimeLogId,
    aiAgentId: log.aiAgentId,
    ticketId: log.ticketId,
    rating,
    tags,
    note,
    reviewedBy: input.reviewedBy
  });

  emitSuggestion();

  return {
    id: created.id,
    rating: created.rating,
    tags: created.tags || [],
    note: created.note,
    reviewedBy: created.reviewedBy,
    reviewedAt: created.updatedAt
  };
}
