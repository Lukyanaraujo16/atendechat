import AppError from "../../errors/AppError";

const OPENAI_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{8,}$/;

export const AI_PROVIDER_OPENAI = "openai";

export function parseProvider(value: unknown): string {
  const p = String(value || AI_PROVIDER_OPENAI).trim().toLowerCase();
  if (p !== AI_PROVIDER_OPENAI) {
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

/** Valida formato mínimo sem registar o conteúdo. */
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

export function parseOptionalApiKey(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return validateOpenAiApiKeyFormat(s);
}
