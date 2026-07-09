export const AI_PROVIDER_OPENAI = "openai";
export const AI_PROVIDER_GEMINI = "gemini";

export const AI_PROVIDERS = [AI_PROVIDER_OPENAI, AI_PROVIDER_GEMINI];

export const OPENAI_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-3.5-turbo-1106",
];

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export const DEFAULT_MODEL_BY_PROVIDER = {
  [AI_PROVIDER_OPENAI]: "gpt-4o-mini",
  [AI_PROVIDER_GEMINI]: "gemini-2.5-flash",
};

export const PROVIDER_LABELS = {
  [AI_PROVIDER_OPENAI]: "OpenAI",
  [AI_PROVIDER_GEMINI]: "Google Gemini",
};

export function getModelsForProvider(provider) {
  if (provider === AI_PROVIDER_GEMINI) return GEMINI_MODELS;
  return OPENAI_MODELS;
}

export function getAllModels() {
  return [...OPENAI_MODELS, ...GEMINI_MODELS];
}

export function resolveProviderLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || "-";
}

export function resolveEffectiveProvider(credentialId, credentials) {
  if (credentialId === "" || credentialId == null) {
    const defaultCred = credentials.find((c) => c.isDefault && c.enabled);
    return defaultCred?.provider || null;
  }
  const selected = credentials.find((c) => String(c.id) === String(credentialId));
  return selected?.provider || null;
}
