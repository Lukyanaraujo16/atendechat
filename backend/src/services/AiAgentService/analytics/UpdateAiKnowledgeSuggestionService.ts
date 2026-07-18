import AppError from "../../../errors/AppError";
import AiKnowledgeSuggestion from "../../../models/AiKnowledgeSuggestion";
import { AI_KNOWLEDGE_SUGGESTION_STATUSES } from "../../../config/aiAgentAnalyticsConstants";

export default async function UpdateAiKnowledgeSuggestionService(input: {
  companyId: number;
  id: number;
  status: string;
  reviewedBy?: number | null;
}) {
  const status = String(input.status || "").trim().toLowerCase();
  if (!(AI_KNOWLEDGE_SUGGESTION_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Status inválido. Use pending, accepted, rejected ou ignored."
    );
  }

  const suggestion = await AiKnowledgeSuggestion.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!suggestion) {
    throw new AppError(
      "ERR_NOT_FOUND",
      404,
      "Sugestão de conhecimento não encontrada."
    );
  }

  // Nunca aprova automaticamente em documentos — só atualiza status assistido.
  await suggestion.update({
    status,
    reviewedBy: input.reviewedBy ?? suggestion.reviewedBy,
    reviewedAt: status === "pending" ? null : new Date()
  });

  return suggestion;
}
