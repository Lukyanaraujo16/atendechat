import AppError from "../../errors/AppError";
import {
  AI_AGENT_MAX_TOKENS_MAX,
  AI_AGENT_MAX_TOKENS_MIN,
  AI_AGENT_TEMPERATURE_MAX,
  AI_AGENT_TEMPERATURE_MIN,
  DEFAULT_AI_AGENT_MAX_TOKENS,
  DEFAULT_AI_AGENT_MODEL,
  DEFAULT_AI_AGENT_TEMPERATURE
} from "../../config/aiAgentDefaults";

const ALLOWED_MODELS = new Set([
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-3.5-turbo-1106"
]);

export function parseAiAgentTemperature(value: unknown): number {
  const n =
    value === undefined || value === null
      ? DEFAULT_AI_AGENT_TEMPERATURE
      : Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Temperatura inválida.");
  }
  if (n < AI_AGENT_TEMPERATURE_MIN || n > AI_AGENT_TEMPERATURE_MAX) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `Temperatura deve estar entre ${AI_AGENT_TEMPERATURE_MIN} e ${AI_AGENT_TEMPERATURE_MAX}.`
    );
  }
  return Math.round(n * 100) / 100;
}

export function parseAiAgentMaxTokens(value: unknown): number {
  const n =
    value === undefined || value === null
      ? DEFAULT_AI_AGENT_MAX_TOKENS
      : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Máximo de tokens inválido.");
  }
  if (n < AI_AGENT_MAX_TOKENS_MIN || n > AI_AGENT_MAX_TOKENS_MAX) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `Máximo de tokens deve estar entre ${AI_AGENT_MAX_TOKENS_MIN} e ${AI_AGENT_MAX_TOKENS_MAX}.`
    );
  }
  return n;
}

export function parseAiAgentModel(value: unknown): string {
  const model =
    value === undefined || value === null || String(value).trim() === ""
      ? DEFAULT_AI_AGENT_MODEL
      : String(value).trim();
  if (!ALLOWED_MODELS.has(model)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Modelo inválido.");
  }
  return model;
}
