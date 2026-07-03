import { Op } from "sequelize";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import AiAgent from "../../models/AiAgent";
import { AI_AGENT_SHADOW_STATUSES, AiAgentShadowStatus } from "./aiAgentShadowErrors";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type ListAiAgentShadowSuggestionsInput = {
  companyId: number;
  pageNumber?: string | number;
  aiAgentId?: number;
  shadowStatus?: string;
  eligible?: boolean;
};

function parsePage(pageNumber?: string | number): number {
  const page = Number(pageNumber ?? 1);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function sanitizeStatus(status?: string): AiAgentShadowStatus | null {
  if (!status || String(status).trim() === "") return null;
  const raw = String(status).trim().toLowerCase();
  const allowed = new Set<string>(Object.values(AI_AGENT_SHADOW_STATUSES));
  return allowed.has(raw) ? (raw as AiAgentShadowStatus) : null;
}

export default async function ListAiAgentShadowSuggestionsService(
  input: ListAiAgentShadowSuggestionsInput
) {
  const page = parsePage(input.pageNumber);
  const limit = DEFAULT_LIMIT;
  const offset = limit * (page - 1);

  const where: Record<string, unknown> = {
    companyId: input.companyId,
    shadowStatus: {
      [Op.ne]: AI_AGENT_SHADOW_STATUSES.NOT_REQUESTED
    }
  };

  if (input.aiAgentId != null && Number.isFinite(input.aiAgentId)) {
    where.aiAgentId = input.aiAgentId;
  }

  const status = sanitizeStatus(input.shadowStatus);
  if (status) {
    where.shadowStatus = status;
  }

  if (input.eligible === true || input.eligible === false) {
    where.eligible = input.eligible;
  }

  const { count, rows } = await AiAgentRuntimeLog.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: AiAgent,
        attributes: ["id", "name"],
        required: false
      }
    ],
    attributes: [
      "id",
      "ticketId",
      "aiAgentId",
      "eligible",
      "reason",
      "mode",
      "shadowStatus",
      "suggestedReply",
      "suggestionSource",
      "shadowModel",
      "promptTokens",
      "completionTokens",
      "totalTokens",
      "latencyMs",
      "errorCode",
      "generatedAt",
      "contextMessageCount",
      "createdAt",
      "metadata"
    ]
  });

  const records = rows.map((row) => {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    return {
      id: row.id,
      ticketId: row.ticketId,
      aiAgentId: row.aiAgentId,
      aiAgentName: row.aiAgent?.name ?? null,
      eligible: row.eligible,
      reason: row.reason,
      mode: row.mode,
      shadowStatus: row.shadowStatus,
      suggestedReply: row.suggestedReply,
      suggestionSource: row.suggestionSource,
      model: row.shadowModel,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      latencyMs: row.latencyMs,
      errorCode: row.errorCode,
      generatedAt: row.generatedAt,
      contextMessageCount: row.contextMessageCount,
      createdAt: row.createdAt,
      messageType:
        typeof meta.messageType === "string" ? meta.messageType : null,
      notSentToClient: true
    };
  });

  return {
    records,
    count,
    hasMore: count > offset + rows.length,
    page,
    limit
  };
}
