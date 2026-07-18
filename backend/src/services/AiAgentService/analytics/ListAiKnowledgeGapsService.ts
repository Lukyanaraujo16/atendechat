import { WhereOptions } from "sequelize";
import AiKnowledgeGap from "../../../models/AiKnowledgeGap";

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

export default async function ListAiKnowledgeGapsService(input: {
  companyId: number;
  aiAgentId?: number | null;
  resolved?: boolean | null;
  reason?: string | null;
  sort?: "frequency" | "lastSeenAt" | string;
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
  if (input.resolved === true || input.resolved === false) {
    Object.assign(where, { resolved: input.resolved });
  }
  if (input.reason) {
    Object.assign(where, { reason: String(input.reason) });
  }

  const sort =
    input.sort === "lastSeenAt" ? "lastSeenAt" : "frequency";

  const { count, rows } = await AiKnowledgeGap.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      [sort, "DESC"],
      ["id", "DESC"]
    ]
  });

  return {
    records: rows,
    count,
    hasMore: count > offset + rows.length,
    page,
    limit
  };
}
