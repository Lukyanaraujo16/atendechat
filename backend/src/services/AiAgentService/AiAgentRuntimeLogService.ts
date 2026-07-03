import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import Whatsapp from "../../models/Whatsapp";
import {
  AI_AGENT_DRY_RUN_LOG_NON_CONFIGURED,
  AI_AGENT_EVALUATOR_VERSION
} from "./aiAgentDryRunConfig";
import {
  AiAgentEvaluationMode,
  AiAgentEvaluationResult
} from "./aiAgentEvaluationReasons";
import { sanitizeAiAgentRuntimeMetadata } from "./sanitizeAiAgentRuntimeMetadata";
import { logger } from "../../utils/logger";
import { UniqueConstraintError } from "sequelize";

export type PersistAiAgentRuntimeLogInput = {
  companyId: number;
  ticketId?: number | null;
  contactId?: number | null;
  whatsappId?: number | null;
  channel: string;
  evaluation: AiAgentEvaluationResult;
  messageId?: string | null;
  metadata?: Record<string, unknown>;
};

export function isWhatsappAiAgentConfigured(whatsapp: Whatsapp): boolean {
  return whatsapp.aiAgentEnabled === true || whatsapp.aiAgentId != null;
}

export function shouldPersistAiAgentRuntimeLog(
  whatsapp: Whatsapp,
  reason: string
): boolean {
  if (isWhatsappAiAgentConfigured(whatsapp)) {
    return true;
  }
  if (!AI_AGENT_DRY_RUN_LOG_NON_CONFIGURED) {
    return false;
  }
  return reason !== "plan_disabled";
}

export async function findAiAgentRuntimeLogByMessageKey(input: {
  companyId: number;
  whatsappId: number;
  channel: string;
  messageId: string;
}): Promise<AiAgentRuntimeLog | null> {
  return AiAgentRuntimeLog.findOne({
    where: {
      companyId: input.companyId,
      whatsappId: input.whatsappId,
      channel: input.channel,
      messageId: input.messageId
    }
  });
}

export async function persistAiAgentRuntimeLog(
  input: PersistAiAgentRuntimeLogInput
): Promise<"created" | "duplicate" | "skipped"> {
  const metadata = sanitizeAiAgentRuntimeMetadata({
    ...(input.metadata || {}),
    ...(input.evaluation.metadata || {}),
    evaluationDurationMs: input.evaluation.evaluationDurationMs ?? null,
    evaluatorVersion: AI_AGENT_EVALUATOR_VERSION
  });

  const messageId =
    input.messageId != null && String(input.messageId).trim() !== ""
      ? String(input.messageId).trim()
      : null;

  if (messageId) {
    const existing = await findAiAgentRuntimeLogByMessageKey({
      companyId: input.companyId,
      whatsappId: input.whatsappId ?? 0,
      channel: input.channel,
      messageId
    });
    if (existing) {
      logger.info(
        {
          companyId: input.companyId,
          ticketId: input.ticketId ?? null,
          whatsappId: input.whatsappId ?? null,
          messageId,
          existingLogId: existing.id
        },
        "[AiAgent][dry_run] duplicate_message"
      );
      return "duplicate";
    }
  }

  try {
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
      messageId,
      metadata
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      logger.info(
        {
          companyId: input.companyId,
          ticketId: input.ticketId ?? null,
          whatsappId: input.whatsappId ?? null,
          messageId
        },
        "[AiAgent][dry_run] duplicate_message"
      );
      return "duplicate";
    }
    throw err;
  }

  logger.info(
    {
      companyId: input.companyId,
      ticketId: input.ticketId ?? null,
      whatsappId: input.whatsappId ?? null,
      aiAgentId: input.evaluation.aiAgentId ?? null,
      messageId,
      eligible: input.evaluation.eligible,
      reason: input.evaluation.reason,
      mode: input.evaluation.mode,
      evaluationDurationMs: input.evaluation.evaluationDurationMs ?? null
    },
    "[AiAgent][dry_run] evaluation_logged"
  );

  return "created";
}
