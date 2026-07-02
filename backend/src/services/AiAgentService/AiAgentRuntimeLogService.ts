import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import {
  AiAgentEvaluationMode,
  AiAgentEvaluationResult
} from "./aiAgentEvaluationReasons";
import { logger } from "../../utils/logger";

export type PersistAiAgentRuntimeLogInput = {
  companyId: number;
  ticketId?: number | null;
  contactId?: number | null;
  whatsappId?: number | null;
  channel: string;
  evaluation: AiAgentEvaluationResult;
  messageId?: string;
  metadata?: Record<string, unknown>;
};

export async function persistAiAgentRuntimeLog(
  input: PersistAiAgentRuntimeLogInput
): Promise<void> {
  const metadata = {
    ...(input.metadata || {}),
    messageId: input.messageId ?? null
  };

  await AiAgentRuntimeLog.create({
    companyId: input.companyId,
    ticketId: input.ticketId ?? null,
    contactId: input.contactId ?? null,
    whatsappId: input.whatsappId ?? null,
    aiAgentId: input.evaluation.aiAgentId ?? null,
    channel: input.channel,
    mode: input.evaluation.mode as AiAgentEvaluationMode,
    eligible: input.evaluation.eligible,
    reason: input.evaluation.reason,
    metadata
  });

  logger.info(
    {
      companyId: input.companyId,
      ticketId: input.ticketId ?? null,
      whatsappId: input.whatsappId ?? null,
      aiAgentId: input.evaluation.aiAgentId ?? null,
      messageId: input.messageId ?? null,
      eligible: input.evaluation.eligible,
      reason: input.evaluation.reason,
      mode: input.evaluation.mode
    },
    "[AiAgent][dry_run] evaluation_logged"
  );
}
