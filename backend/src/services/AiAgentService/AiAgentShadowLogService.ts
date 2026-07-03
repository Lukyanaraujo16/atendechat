import { Op } from "sequelize";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import {
  AI_AGENT_SHADOW_STATUSES,
  AiAgentShadowStatus
} from "./aiAgentShadowErrors";
import { AI_AGENT_SUGGESTED_REPLY_MAX_CHARS } from "./aiAgentShadowConfig";

export type ShadowLogUpdateInput = {
  shadowStatus: AiAgentShadowStatus;
  suggestedReply?: string | null;
  shadowModel?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  generatedAt?: Date | null;
  contextMessageCount?: number | null;
  contextHash?: string | null;
  suggestionSource?: "model" | "fallback" | null;
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
  await AiAgentRuntimeLog.update(
    {
      ...patch,
      suggestedReply:
        patch.suggestedReply !== undefined
          ? truncateReply(patch.suggestedReply)
          : undefined
    },
    { where: { id: logId, companyId } }
  );
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
        shadowStatus: {
          [Op.in]: [
            AI_AGENT_SHADOW_STATUSES.NOT_REQUESTED,
            AI_AGENT_SHADOW_STATUSES.QUEUED
          ]
        }
      }
    }
  );
  return affected > 0;
}
