import {
  DEFAULT_MODEL_BY_PROVIDER,
  getAllModels,
  AI_PROVIDER_OPENAI,
} from "./aiProviderModels";

export const AI_AGENT_MODELS = getAllModels();

export const DEFAULT_AI_AGENT_FORM = {
  name: "",
  description: "",
  enabled: false,
  model: DEFAULT_MODEL_BY_PROVIDER[AI_PROVIDER_OPENAI],
  temperature: 0.3,
  maxTokens: 512,
  systemPrompt: "",
  fallbackMessage: "",
  handoffMessage: "",
  aiProviderCredentialId: "",
  allowAudioInput: false,
  allowAudioOutput: false,
};

export const AI_AGENT_TEMPERATURE_MIN = 0;
export const AI_AGENT_TEMPERATURE_MAX = 2;
export const AI_AGENT_MAX_TOKENS_MIN = 16;
export const AI_AGENT_MAX_TOKENS_MAX = 4096;
