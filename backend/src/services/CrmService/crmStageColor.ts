import AppError from "../../errors/AppError";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeStageColor(input: unknown, fallback: string): string {
  if (input === undefined || input === null || input === "") return fallback;
  const s = String(input).trim();
  if (s.length > 32) {
    throw new AppError("ERR_CRM_STAGE_INVALID_COLOR", 400);
  }
  if (!HEX_RE.test(s)) {
    throw new AppError("ERR_CRM_STAGE_INVALID_COLOR", 400);
  }
  return s;
}
