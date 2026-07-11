import AppError from "../../errors/AppError";
import AiAgentSimulationMessageReview from "../../models/AiAgentSimulationMessageReview";
import {
  AI_AGENT_SIMULATION_REVIEW_NOTE_MAX_LENGTH,
  AI_AGENT_SIMULATION_REVIEW_RATINGS,
  AI_AGENT_SIMULATION_REVIEW_TAGS,
  AiAgentSimulationReviewRating,
  AiAgentSimulationReviewTag
} from "./aiAgentSimulationReviewConfig";
import {
  findSimulationMessageOrThrow,
  findSimulationSessionOrThrow
} from "./aiAgentSimulationSerialization";

type ReviewBody = {
  rating?: unknown;
  tags?: unknown;
  note?: unknown;
};

function parseRating(value: unknown): AiAgentSimulationReviewRating {
  const rating = String(value || "").trim().toLowerCase();
  if (!(AI_AGENT_SIMULATION_REVIEW_RATINGS as readonly string[]).includes(rating)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Avaliação inválida.");
  }
  return rating as AiAgentSimulationReviewRating;
}

function parseTags(value: unknown): AiAgentSimulationReviewTag[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Tags inválidas.");
  }
  const tags = value
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean);
  for (const tag of tags) {
    if (!(AI_AGENT_SIMULATION_REVIEW_TAGS as readonly string[]).includes(tag)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "Tag de avaliação inválida.");
    }
  }
  return [...new Set(tags)] as AiAgentSimulationReviewTag[];
}

function parseNote(value: unknown): string | null {
  if (value == null || String(value).trim() === "") return null;
  const note = String(value).trim();
  if (note.length > AI_AGENT_SIMULATION_REVIEW_NOTE_MAX_LENGTH) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `Observação deve ter no máximo ${AI_AGENT_SIMULATION_REVIEW_NOTE_MAX_LENGTH} caracteres.`
    );
  }
  return note;
}

export default async function UpsertAiAgentSimulationMessageReviewService(input: {
  companyId: number;
  aiAgentId: number;
  sessionId: number;
  messageId: number;
  reviewedBy: number;
  body: ReviewBody;
}) {
  await findSimulationSessionOrThrow({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    sessionId: input.sessionId
  });

  const message = await findSimulationMessageOrThrow({
    companyId: input.companyId,
    sessionId: input.sessionId,
    messageId: input.messageId
  });

  if (message.role !== "assistant") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Somente respostas do atendente podem ser avaliadas."
    );
  }

  const rating = parseRating(input.body.rating);
  const tags = parseTags(input.body.tags);
  const note = parseNote(input.body.note);

  const existing = await AiAgentSimulationMessageReview.findOne({
    where: {
      companyId: input.companyId,
      simulationMessageId: message.id
    }
  });

  if (existing) {
    await existing.update({
      rating,
      tags,
      note,
      reviewedBy: input.reviewedBy
    });
    return {
      id: existing.id,
      rating: existing.rating,
      tags: existing.tags || [],
      note: existing.note,
      reviewedBy: existing.reviewedBy,
      reviewedAt: existing.updatedAt
    };
  }

  const created = await AiAgentSimulationMessageReview.create({
    companyId: input.companyId,
    simulationMessageId: message.id,
    rating,
    tags,
    note,
    reviewedBy: input.reviewedBy
  });

  return {
    id: created.id,
    rating: created.rating,
    tags: created.tags || [],
    note: created.note,
    reviewedBy: created.reviewedBy,
    reviewedAt: created.updatedAt
  };
}
