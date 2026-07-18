import { Op } from "sequelize";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import {
  AI_AGENT_SHADOW_STATUSES,
  AiAgentShadowStatus
} from "./aiAgentShadowErrors";
import { AI_AGENT_SUGGESTED_REPLY_MAX_CHARS } from "./aiAgentShadowConfig";
import { sanitizeAiAgentRuntimeMetadata } from "./sanitizeAiAgentRuntimeMetadata";

export type ShadowLogUpdateInput = {
  shadowStatus?: AiAgentShadowStatus;
  suggestedReply?: string | null;
  shadowModel?: string | null;
  shadowProvider?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  generatedAt?: Date | null;
  contextMessageCount?: number | null;
  contextHash?: string | null;
  suggestionSource?: "model" | "fallback" | null;
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

export async function updateAiAgentShadowLog(
  logId: number,
  companyId: number,
  patch: ShadowLogUpdateInput
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

  await AiAgentRuntimeLog.update(updatePayload, { where: { id: logId, companyId } });
}

export async function mergeAiAgentShadowLogMetadata(
  logId: number,
  companyId: number,
  metadataPatch: Record<string, unknown>
): Promise<void> {
  await updateAiAgentShadowLog(logId, companyId, { metadataPatch });
}

/** Marca gerações enfileiradas anteriores como substituídas pelo debounce. */
export async function markSupersededShadowLogs(
  ticketId: number,
  companyId: number,
  exceptLogId: number
): Promise<void> {
  await AiAgentRuntimeLog.update(
    {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.SKIPPED,
      errorCode: "debounced_superseded"
    },
    {
      where: {
        ticketId,
        companyId,
        shadowStatus: AI_AGENT_SHADOW_STATUSES.QUEUED,
        id: { [Op.ne]: exceptLogId }
      }
    }
  );
}

export async function claimShadowGeneration(
  logId: number,
  companyId: number
): Promise<boolean> {
  const [affected] = await AiAgentRuntimeLog.update(
    { shadowStatus: AI_AGENT_SHADOW_STATUSES.QUEUED },
    {
      where: {
        id: logId,
        companyId,
        shadowStatus: AI_AGENT_SHADOW_STATUSES.NOT_REQUESTED
      }
    }
  );
  if (affected > 0) return true;

  const row = await AiAgentRuntimeLog.findOne({
    where: {
      id: logId,
      companyId,
      shadowStatus: AI_AGENT_SHADOW_STATUSES.QUEUED
    },
    attributes: ["id"]
  });
  return Boolean(row);
}
