import { Op, WhereOptions } from "sequelize";
import AppError from "../../errors/AppError";
import { AI_PROVIDERS, isAiProviderId } from "../../config/aiProviderModels";
import { AI_AGENT_SHADOW_STATUSES } from "./aiAgentShadowErrors";

export type ShadowSuggestionListFilters = {
  companyId: number;
  pageNumber?: string | number;
  aiAgentId?: number;
  shadowStatus?: string;
  shadowProvider?: string;
  shadowModel?: string;
  eligible?: boolean;
  errorCode?: string;
  suggestionSource?: string;
  ticketId?: number;
  dateFrom?: string;
  dateTo?: string;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function parseShadowPage(pageNumber?: string | number): number {
  const page = Number(pageNumber ?? 1);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

export function getShadowListLimit(): number {
  return DEFAULT_LIMIT;
}

export function parseOptionalPositiveInt(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value == null || String(value).trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, `${fieldName} inválido.`);
  }
  return Math.floor(n);
}

export function parseOptionalBoolean(
  value: unknown
): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseShadowStatus(value?: string): string | null {
  if (!value || String(value).trim() === "") return null;
  const raw = String(value).trim().toLowerCase();
  const allowed = new Set<string>(Object.values(AI_AGENT_SHADOW_STATUSES));
  if (!allowed.has(raw)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "shadowStatus inválido.");
  }
  return raw;
}

function parseShadowProvider(value?: string): string | null {
  if (!value || String(value).trim() === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (!isAiProviderId(raw)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "shadowProvider inválido.");
  }
  return raw;
}

function parseSuggestionSource(value?: string): string | null {
  if (!value || String(value).trim() === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === "null") return "null";
  if (raw === "model" || raw === "fallback") return raw;
  throw new AppError("ERR_VALIDATION_ERROR", 400, "suggestionSource inválido.");
}

function parseDateBoundary(value?: string, fieldName?: string): Date | null {
  if (!value || String(value).trim() === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, `${fieldName} inválido.`);
  }
  return d;
}

export function buildShadowSuggestionWhere(
  input: ShadowSuggestionListFilters
): WhereOptions {
  const where: Record<string, unknown> = {
    companyId: input.companyId
  };

  const status = parseShadowStatus(input.shadowStatus);
  if (status) {
    where.shadowStatus = status;
  } else {
    where.shadowStatus = {
      [Op.ne]: AI_AGENT_SHADOW_STATUSES.NOT_REQUESTED
    };
  }

  if (input.aiAgentId != null) where.aiAgentId = input.aiAgentId;
  if (input.ticketId != null) where.ticketId = input.ticketId;

  const provider = parseShadowProvider(input.shadowProvider);
  if (provider) where.shadowProvider = provider;

  if (input.shadowModel?.trim()) {
    where.shadowModel = String(input.shadowModel).trim();
  }

  if (input.eligible === true || input.eligible === false) {
    where.eligible = input.eligible;
  }

  if (input.errorCode?.trim()) {
    where.errorCode = String(input.errorCode).trim();
  }

  const suggestionSource = parseSuggestionSource(input.suggestionSource);
  if (suggestionSource === "null") {
    where.suggestionSource = null;
  } else if (suggestionSource) {
    where.suggestionSource = suggestionSource;
  }

  const dateFrom = parseDateBoundary(input.dateFrom, "dateFrom");
  const dateTo = parseDateBoundary(input.dateTo, "dateTo");
  if (dateFrom || dateTo) {
    const createdAt: Record<symbol, Date> = {};
    if (dateFrom) createdAt[Op.gte] = dateFrom;
    if (dateTo) createdAt[Op.lte] = dateTo;
    where.createdAt = createdAt;
  }

  return where as WhereOptions;
}

export function defaultSummaryDateFrom(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export { DEFAULT_LIMIT, MAX_LIMIT, AI_PROVIDERS };
