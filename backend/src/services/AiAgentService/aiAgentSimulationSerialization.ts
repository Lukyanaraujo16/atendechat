import AppError from "../../errors/AppError";
import AiAgentSimulationSession from "../../models/AiAgentSimulationSession";
import AiAgentSimulationMessage from "../../models/AiAgentSimulationMessage";
import AiAgentSimulationMessageReview from "../../models/AiAgentSimulationMessageReview";
import { findAiAgentOrThrow } from "./aiAgentTenant";

export async function findSimulationSessionOrThrow(input: {
  companyId: number;
  aiAgentId: number;
  sessionId: number;
}): Promise<AiAgentSimulationSession> {
  await findAiAgentOrThrow(input.companyId, input.aiAgentId);

  const session = await AiAgentSimulationSession.findOne({
    where: {
      id: input.sessionId,
      companyId: input.companyId,
      aiAgentId: input.aiAgentId
    }
  });

  if (!session) {
    throw new AppError(
      "ERR_AI_AGENT_SIMULATION_SESSION_NOT_FOUND",
      404,
      "Sessão de simulação não encontrada."
    );
  }

  return session;
}

export async function findSimulationMessageOrThrow(input: {
  companyId: number;
  sessionId: number;
  messageId: number;
}): Promise<AiAgentSimulationMessage> {
  const message = await AiAgentSimulationMessage.findOne({
    where: {
      id: input.messageId,
      companyId: input.companyId,
      sessionId: input.sessionId
    }
  });

  if (!message) {
    throw new AppError(
      "ERR_AI_AGENT_SIMULATION_MESSAGE_NOT_FOUND",
      404,
      "Mensagem de simulação não encontrada."
    );
  }

  return message;
}

export function serializeSimulationMessageReview(
  review: AiAgentSimulationMessageReview | null | undefined
) {
  if (!review) return null;
  return {
    id: review.id,
    rating: review.rating,
    tags: review.tags || [],
    note: review.note,
    reviewedBy: review.reviewedBy,
    reviewedAt: review.updatedAt
  };
}

export function serializeSimulationMessage(
  message: AiAgentSimulationMessage & {
    review?: AiAgentSimulationMessageReview | null;
  }
) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    provider: message.provider,
    model: message.model,
    promptTokens: message.promptTokens,
    completionTokens: message.completionTokens,
    totalTokens: message.totalTokens,
    latencyMs: message.latencyMs,
    errorCode: message.errorCode,
    handoffSuggested: message.handoffSuggested,
    handoffReason: message.handoffReason,
    createdAt: message.createdAt,
    review: serializeSimulationMessageReview(message.review)
  };
}

export function serializeSimulationSession(
  session: AiAgentSimulationSession,
  messages: Array<
    AiAgentSimulationMessage & { review?: AiAgentSimulationMessageReview | null }
  > = []
) {
  const assistantMessages = messages.filter((item) => item.role === "assistant");
  const averageLatencyMs =
    assistantMessages.length > 0
      ? Math.round(
          assistantMessages.reduce((sum, item) => sum + (item.latencyMs || 0), 0) /
            assistantMessages.length
        )
      : 0;

  return {
    id: session.id,
    aiAgentId: session.aiAgentId,
    status: session.status,
    provider: session.provider,
    model: session.model,
    messageCount: session.messageCount,
    totalPromptTokens: session.totalPromptTokens,
    totalCompletionTokens: session.totalCompletionTokens,
    totalTokens: session.totalTokens,
    totalLatencyMs: session.totalLatencyMs,
    averageLatencyMs,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: messages.map(serializeSimulationMessage)
  };
}
