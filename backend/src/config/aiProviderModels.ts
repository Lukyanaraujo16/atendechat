export const AI_PROVIDER_OPENAI = "openai" as const;
export const AI_PROVIDER_GEMINI = "gemini" as const;

export const AI_PROVIDERS = [AI_PROVIDER_OPENAI, AI_PROVIDER_GEMINI] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const OPENAI_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-3.5-turbo-1106"
] as const;

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
] as const;

export const DEFAULT_MODEL_BY_PROVIDER: Record<AiProviderId, string> = {
  [AI_PROVIDER_OPENAI]: "gpt-4o-mini",
  [AI_PROVIDER_GEMINI]: "gemini-2.5-flash"
};

const MODELS_BY_PROVIDER: Record<AiProviderId, readonly string[]> = {
  [AI_PROVIDER_OPENAI]: OPENAI_MODELS,
  [AI_PROVIDER_GEMINI]: GEMINI_MODELS
};

export function isAiProviderId(value: string): value is AiProviderId {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

export function getModelsForProvider(provider: AiProviderId): readonly string[] {
  return MODELS_BY_PROVIDER[provider];
}

export function isModelAllowedForProvider(
  model: string,
  provider: AiProviderId
): boolean {
  return getModelsForProvider(provider).includes(model);
}

export function getAllAllowedModels(): string[] {
  return [...OPENAI_MODELS, ...GEMINI_MODELS];
}

export function resolveDefaultModelForProvider(provider: AiProviderId): string {
  return DEFAULT_MODEL_BY_PROVIDER[provider];
}
