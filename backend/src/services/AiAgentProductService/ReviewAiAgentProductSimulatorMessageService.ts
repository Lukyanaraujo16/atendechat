import { Request } from "express";
import AppError from "../../errors/AppError";
import AiAgentSimulationMessage from "../../models/AiAgentSimulationMessage";
import AiAgentSimulationSession from "../../models/AiAgentSimulationSession";
import UpsertAiAgentSimulationMessageReviewService from "../AiAgentService/UpsertAiAgentSimulationMessageReviewService";
import {
  assertProductSimulatorCanMutate,
  decodeSimulatorMessageRef,
  mapLegacySimulatorError
} from "./aiAgentProductSimulatorHelpers";
import { serializeAiAgentProductSimulatorReview } from "./serializeAiAgentProductSimulator";
import { AiAgentProductSimulatorReview } from "../../types/aiAgentProduct";

export default async function ReviewAiAgentProductSimulatorMessageService(input: {
  companyId: number;
  messageRef: string;
  userId: number;
  body: Record<string, unknown>;
  req?: Request;
}): Promise<AiAgentProductSimulatorReview> {
  const companyId = Number(input.companyId);
  const cap = await assertProductSimulatorCanMutate(companyId, input.req);
  const messageId = decodeSimulatorMessageRef(input.messageRef);

  const message = await AiAgentSimulationMessage.findOne({
    where: { id: messageId, companyId }
  });
  if (!message) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_NOT_FOUND",
      404,
      "Mensagem de simulação não encontrada."
    );
  }

  const session = await AiAgentSimulationSession.findOne({
    where: {
      id: message.sessionId,
      companyId
    }
  });
  if (!session || session.aiAgentId !== cap.agentRow.id) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_MESSAGE_NOT_FOUND",
      404,
      "Mensagem de simulação não encontrada."
    );
  }

  if (message.role !== "assistant") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_INVALID",
      400,
      "Somente respostas do atendente podem ser avaliadas."
    );
  }

  try {
    const review = await UpsertAiAgentSimulationMessageReviewService({
      companyId,
      aiAgentId: cap.agentRow.id,
      sessionId: session.id,
      messageId: message.id,
      reviewedBy: input.userId,
      body: input.body
    });
    return serializeAiAgentProductSimulatorReview({
      rating: review.rating,
      tags: review.tags,
      note: review.note,
      reviewedAt: review.reviewedAt
    })!;
  } catch (err) {
    mapLegacySimulatorError(err);
  }
}
