import { WhereOptions } from "sequelize";
import AiKnowledgeSuggestion from "../../../models/AiKnowledgeSuggestion";
import {
  AI_KNOWLEDGE_SUGGESTION_ORIGINS,
  AI_KNOWLEDGE_SUGGESTION_STATUSES
} from "../../../config/aiAgentAnalyticsConstants";

function parsePage(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(100, Math.floor(n));
}

export default async function ListAiKnowledgeSuggestionsService(input: {
  companyId: number;
  aiAgentId?: number | null;
  status?: string | null;
  origin?: string | null;
  pageNumber?: unknown;
  limit?: unknown;
}) {
  const page = parsePage(input.pageNumber);
  const limit = parseLimit(input.limit);
  const offset = limit * (page - 1);

  const where: WhereOptions = { companyId: input.companyId };

  if (input.aiAgentId != null && Number.isFinite(Number(input.aiAgentId))) {
    Object.assign(where, { aiAgentId: Number(input.aiAgentId) });
  }

  if (
    input.status &&
    (AI_KNOWLEDGE_SUGGESTION_STATUSES as readonly string[]).includes(
      String(input.status)
    )
  ) {
    Object.assign(where, { status: String(input.status) });
  }

  if (
    input.origin &&
    (AI_KNOWLEDGE_SUGGESTION_ORIGINS as readonly string[]).includes(
      String(input.origin)
    )
  ) {
    Object.assign(where, { origin: String(input.origin) });
  }

  const { count, rows } = await AiKnowledgeSuggestion.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });

  return {
    records: rows,
    count,
    hasMore: count > offset + rows.length,
    page,
    limit
  };
}
