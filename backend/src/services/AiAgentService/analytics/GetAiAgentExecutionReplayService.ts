import { WhereOptions } from "sequelize";
import AppError from "../../../errors/AppError";
import AiAgentExecutionReplay from "../../../models/AiAgentExecutionReplay";

function parsePage(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(50, Math.floor(n));
}

export async function showAiAgentExecutionReplay(input: {
  companyId: number;
  id: number;
}) {
  const row = await AiAgentExecutionReplay.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!row) {
    throw new AppError("ERR_NOT_FOUND", 404, "Replay não encontrado.");
  }
  return row;
}

export async function listAiAgentExecutionReplays(input: {
  companyId: number;
  aiAgentId?: number | null;
  channel?: string | null;
  decision?: string | null;
  ticketId?: number | null;
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
  if (input.channel) {
    Object.assign(where, { channel: String(input.channel) });
  }
  if (input.decision) {
    Object.assign(where, { decision: String(input.decision) });
  }
  if (input.ticketId != null && Number.isFinite(Number(input.ticketId))) {
    Object.assign(where, { ticketId: Number(input.ticketId) });
  }

  const { count, rows } = await AiAgentExecutionReplay.findAndCountAll({
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

export default async function GetAiAgentExecutionReplayService(input: {
  companyId: number;
  id?: number | null;
  aiAgentId?: number | null;
  channel?: string | null;
  decision?: string | null;
  ticketId?: number | null;
  pageNumber?: unknown;
  limit?: unknown;
}) {
  if (input.id != null && Number.isFinite(Number(input.id))) {
    const record = await showAiAgentExecutionReplay({
      companyId: input.companyId,
      id: Number(input.id)
    });
    return { record, records: [record], count: 1, hasMore: false, page: 1, limit: 1 };
  }

  return listAiAgentExecutionReplays(input);
}
