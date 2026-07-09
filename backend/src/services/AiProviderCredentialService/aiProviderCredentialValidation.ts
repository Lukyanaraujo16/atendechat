import AppError from "../../errors/AppError";
import {
  AI_PROVIDER_GEMINI,
  AI_PROVIDER_OPENAI,
  AiProviderId,
  isAiProviderId
} from "../../config/aiProviderModels";

const OPENAI_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{8,}$/;
const GEMINI_KEY_MIN_LENGTH = 20;
const GEMINI_KEY_MAX_LENGTH = 256;
const GEMINI_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

export { AI_PROVIDER_OPENAI, AI_PROVIDER_GEMINI };

export function parseProvider(value: unknown): AiProviderId {
  const p = String(value || AI_PROVIDER_OPENAI).trim().toLowerCase();
  if (!isAiProviderId(p)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Provedor de IA não suportado."
    );
  }
  return p;
}

export function parseCredentialName(value: unknown): string {
  const name = String(value || "").trim();
  if (!name || name.length > 120) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Nome da credencial é obrigatório (máx. 120 caracteres)."
    );
  }
  return name;
}

/** Valida formato mínimo OpenAI sem registar o conteúdo. */
export function validateOpenAiApiKeyFormat(apiKey: unknown): string {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "API Key é obrigatória."
    );
  }
  if (key.length < 20 || key.length > 256) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Formato de API Key inválido."
    );
  }
  if (!OPENAI_KEY_PATTERN.test(key)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Formato de API Key OpenAI inválido."
    );
  }
  return key;
}

/** Valida formato mínimo Gemini sem registar o conteúdo. */
export function validateGeminiApiKeyFormat(apiKey: unknown): string {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "API Key é obrigatória."
    );
  }
  if (key.length < GEMINI_KEY_MIN_LENGTH || key.length > GEMINI_KEY_MAX_LENGTH) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Formato de API Key inválido."
    );
  }
  if (!GEMINI_KEY_PATTERN.test(key)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Formato de API Key Google Gemini inválido."
    );
  }
  if (key.startsWith("sk-")) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Formato de API Key Google Gemini inválido."
    );
  }
  return key;
}

export function validateApiKeyForProvider(
  provider: AiProviderId,
  apiKey: unknown
): string {
  if (provider === AI_PROVIDER_GEMINI) {
    return validateGeminiApiKeyFormat(apiKey);
  }
  return validateOpenAiApiKeyFormat(apiKey);
}

export function parseOptionalApiKey(
  value: unknown,
  provider: AiProviderId
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return validateApiKeyForProvider(provider, s);
}
