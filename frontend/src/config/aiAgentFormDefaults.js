export const AI_AGENT_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-3.5-turbo-1106",
];

export const DEFAULT_AI_AGENT_FORM = {
  name: "",
  description: "",
  enabled: false,
  model: "gpt-4o-mini",
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
