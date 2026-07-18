import { logger } from "../../../utils/logger";
import AiAgentExecutionReplay from "../../../models/AiAgentExecutionReplay";
import { AI_ANALYTICS_PREVIEW_MAX_CHARS } from "../../../config/aiAgentAnalyticsConstants";
import { previewText, sanitizeReplaySnapshot } from "./analyticsHelpers";

export type UpsertExecutionReplayInput = {
  companyId: number;
  aiAgentId: number;
  channel: string;
  ticketId?: number | null;
  messageId?: string | null;
  runtimeLogId?: number | null;
  retrievalId?: number | null;
  simulationSessionId?: number | null;
  requestId?: string | null;
  decision?: string | null;
  handoff?: boolean;
  provider?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  messagePreview?: string | null;
  responsePreview?: string | null;
  snapshot?: unknown;
};

async function upsertExecutionReplay(
  input: UpsertExecutionReplayInput
): Promise<AiAgentExecutionReplay | null> {
  const requestId = input.requestId
    ? String(input.requestId).slice(0, 64)
    : null;

  if (requestId) {
    const existing = await AiAgentExecutionReplay.findOne({
      where: {
        companyId: input.companyId,
        requestId
      }
    });
    if (existing) return existing;
  }

  return AiAgentExecutionReplay.create({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    channel: String(input.channel || "unknown").slice(0, 32),
    ticketId: input.ticketId ?? null,
    messageId: input.messageId ? String(input.messageId).slice(0, 191) : null,
    runtimeLogId: input.runtimeLogId ?? null,
    retrievalId: input.retrievalId ?? null,
    simulationSessionId: input.simulationSessionId ?? null,
    requestId,
    decision: input.decision ? String(input.decision).slice(0, 64) : null,
    handoff: Boolean(input.handoff),
    provider: input.provider ? String(input.provider).slice(0, 32) : null,
    model: input.model ? String(input.model).slice(0, 120) : null,
    latencyMs: input.latencyMs ?? null,
    messagePreview: previewText(
      input.messagePreview,
      AI_ANALYTICS_PREVIEW_MAX_CHARS
    ),
    responsePreview: previewText(input.responsePreview, 500),
    snapshot: sanitizeReplaySnapshot(input.snapshot)
  });
}

export async function safeUpsertExecutionReplay(
  input: UpsertExecutionReplayInput
): Promise<AiAgentExecutionReplay | null> {
  try {
    return await upsertExecutionReplay(input);
  } catch (err) {
    logger.warn(
      { err, companyId: input.companyId, aiAgentId: input.aiAgentId },
      "safeUpsertExecutionReplay failed"
    );
    return null;
  }
}

export default upsertExecutionReplay;
