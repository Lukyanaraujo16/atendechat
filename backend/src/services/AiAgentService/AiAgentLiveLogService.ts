import { Op } from "sequelize";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import { AI_AGENT_SUGGESTED_REPLY_MAX_CHARS } from "./aiAgentShadowConfig";
import { sanitizeAiAgentRuntimeMetadata } from "./sanitizeAiAgentRuntimeMetadata";
import {
  AI_AGENT_LIVE_DELIVERY_STATUSES,
  AI_AGENT_LIVE_STATUSES,
  AiAgentLiveStatus
} from "./aiAgentLiveErrors";

export type LiveLogUpdateInput = {
  liveStatus?: AiAgentLiveStatus;
  suggestedReply?: string | null;
  liveModel?: string | null;
  liveProvider?: string | null;
  livePromptTokens?: number | null;
  liveCompletionTokens?: number | null;
  liveTotalTokens?: number | null;
  liveLatencyMs?: number | null;
  errorCode?: string | null;
  sendErrorCode?: string | null;
  generatedAt?: Date | null;
  sentAt?: Date | null;
  sentMessageId?: string | null;
  deliveryStatus?: string;
  contextMessageCount?: number | null;
  contextHash?: string | null;
  suggestionSource?: "model" | "handoff_transition" | "media_fallback" | null;
  metadataPatch?: Record<string, unknown>;
};

function truncateReply(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  return t.length > AI_AGENT_SUGGESTED_REPLY_MAX_CHARS
    ? t.slice(0, AI_AGENT_SUGGESTED_REPLY_MAX_CHARS)
    : t;
}

export async function updateAiAgentLiveLog(
  logId: number,
  companyId: number,
  patch: LiveLogUpdateInput
): Promise<void> {
  const { metadataPatch, ...rest } = patch;
  const updatePayload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  }

  if (patch.suggestedReply !== undefined) {
    updatePayload.suggestedReply = truncateReply(patch.suggestedReply);
  }

  if (metadataPatch && Object.keys(metadataPatch).length > 0) {
    const row = await AiAgentRuntimeLog.findOne({
      where: { id: logId, companyId },
      attributes: ["metadata"]
    });
    if (row) {
      updatePayload.metadata = sanitizeAiAgentRuntimeMetadata({
        ...((row.metadata || {}) as Record<string, unknown>),
        ...metadataPatch
      });
    }
  }

  await AiAgentRuntimeLog.update(updatePayload, {
    where: { id: logId, companyId }
  });
}

export async function mergeAiAgentLiveLogMetadata(
  logId: number,
  companyId: number,
  metadataPatch: Record<string, unknown>
): Promise<void> {
  await updateAiAgentLiveLog(logId, companyId, { metadataPatch });
}

export async function markSupersededLiveLogs(
  ticketId: number,
  companyId: number,
  exceptLogId: number
): Promise<void> {
  await AiAgentRuntimeLog.update(
    {
      liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
      errorCode: "debounced_superseded"
    },
    {
      where: {
        ticketId,
        companyId,
        mode: "live",
        liveStatus: AI_AGENT_LIVE_STATUSES.QUEUED,
        id: { [Op.ne]: exceptLogId }
      }
    }
  );
}

export async function claimLiveGeneration(
  logId: number,
  companyId: number
): Promise<boolean> {
  // Apenas not_requested → queued (evita re-claim de jobs já em andamento).
  const [affected] = await AiAgentRuntimeLog.update(
    { liveStatus: AI_AGENT_LIVE_STATUSES.QUEUED },
    {
      where: {
        id: logId,
        companyId,
        mode: "live",
        liveStatus: AI_AGENT_LIVE_STATUSES.NOT_REQUESTED,
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.NOT_SENT
      }
    }
  );
  if (affected > 0) return true;

  // Aceita claim se já estiver queued por este fluxo (debounce agendou)
  // e ainda não enviado — exclusivo via Redis lock no caller.
  const row = await AiAgentRuntimeLog.findOne({
    where: {
      id: logId,
      companyId,
      mode: "live",
      liveStatus: AI_AGENT_LIVE_STATUSES.QUEUED,
      deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.NOT_SENT
    },
    attributes: ["id"]
  });
  return Boolean(row);
}

export async function claimLiveSending(
  logId: number,
  companyId: number
): Promise<boolean> {
  const [affected] = await AiAgentRuntimeLog.update(
    { liveStatus: AI_AGENT_LIVE_STATUSES.SENDING },
    {
      where: {
        id: logId,
        companyId,
        mode: "live",
        liveStatus: AI_AGENT_LIVE_STATUSES.GENERATED,
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.NOT_SENT
      }
    }
  );
  return affected > 0;
}
