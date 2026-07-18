import { Op, Sequelize, WhereOptions } from "sequelize";
import AppError from "../../errors/AppError";
import { AI_PROVIDERS, isAiProviderId } from "../../config/aiProviderModels";
import { AI_AGENT_SHADOW_STATUSES } from "./aiAgentShadowErrors";

function getDbDialect(): string {
  return String(process.env.DB_DIALECT || "mysql").toLowerCase();
}

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
  /** with | without | empty | error */
  knowledgeUsage?: string;
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

  const knowledgeUsage = String(input.knowledgeUsage || "")
    .trim()
    .toLowerCase();
  if (knowledgeUsage) {
    const dialect = getDbDialect();
    const statusPath =
      dialect === "postgres"
        ? `(metadata->'knowledge'->>'status')`
        : `JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.knowledge.status'))`;
    const performedPath =
      dialect === "postgres"
        ? `(metadata->'knowledge'->>'performed')`
        : `JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.knowledge.performed'))`;
    const missingPath =
      dialect === "postgres"
        ? `(metadata->'knowledge'->>'knowledgeMissing')`
        : `JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.knowledge.knowledgeMissing'))`;

    const knowledgeAnd: ReturnType<typeof Sequelize.literal>[] = [];
    if (knowledgeUsage === "with") {
      knowledgeAnd.push(
        Sequelize.literal(`${statusPath} = 'completed'`),
        Sequelize.literal(
          `(${missingPath} = 'false' OR ${missingPath} = '0')`
        )
      );
    } else if (knowledgeUsage === "empty") {
      knowledgeAnd.push(Sequelize.literal(`${statusPath} = 'empty'`));
    } else if (knowledgeUsage === "error") {
      knowledgeAnd.push(Sequelize.literal(`${statusPath} = 'failed'`));
    } else if (knowledgeUsage === "without") {
      knowledgeAnd.push(
        Sequelize.literal(
          `(metadata IS NULL OR ${performedPath} IS NULL OR ${performedPath} IN ('false','0') OR ${statusPath} IN ('skipped','empty') OR ${missingPath} IN ('true','1'))`
        )
      );
    } else {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "knowledgeUsage inválido (with|without|empty|error)."
      );
    }
    Object.assign(where, { [Op.and]: knowledgeAnd });
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
