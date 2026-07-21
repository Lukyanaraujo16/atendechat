export const TOOL_READ_DEFAULT_LIMIT = 10;
export const TOOL_READ_MAX_LIMIT = 50;

export type ToolPagination = {
  limit: number;
  offset: number;
};

/**
 * Paginação conservadora para Tools de leitura.
 */
export function resolveToolPagination(input: {
  limit?: unknown;
  offset?: unknown;
  maxLimit?: number;
  defaultLimit?: number;
}): ToolPagination {
  const maxLimit = input.maxLimit ?? TOOL_READ_MAX_LIMIT;
  const defaultLimit = input.defaultLimit ?? TOOL_READ_DEFAULT_LIMIT;
  let limit = Number(input.limit);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(Math.floor(limit), maxLimit);

  let offset = Number(input.offset);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  offset = Math.floor(offset);

  return { limit, offset };
}

export function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 8) return "***";
  return `***${digits.slice(-4)}`;
}
