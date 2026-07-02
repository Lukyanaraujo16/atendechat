import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";

export async function findAiAgentOrThrow(
  companyId: number,
  id: number
): Promise<AiAgent> {
  const row = await AiAgent.findOne({ where: { id, companyId } });
  if (!row) {
    throw new AppError("ERR_AI_AGENT_NOT_FOUND", 404, "Agente de IA não encontrado.");
  }
  return row;
}

export function normalizeOptionalString(
  value: unknown,
  maxLen?: number
): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (maxLen != null && s.length > maxLen) {
    return s.slice(0, maxLen);
  }
  return s;
}

export function parseRequiredName(value: unknown): string {
  const name = normalizeOptionalString(value, 120);
  if (!name) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Nome do agente é obrigatório.");
  }
  return name;
}

export function parseBooleanField(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}
