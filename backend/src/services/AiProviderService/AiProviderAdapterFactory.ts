import AppError from "../../errors/AppError";
import {
  AI_PROVIDER_GEMINI,
  AI_PROVIDER_OPENAI,
  AiProviderId,
  isAiProviderId
} from "../../config/aiProviderModels";
import GeminiProviderAdapter from "./GeminiProviderAdapter";
import OpenAiProviderAdapter from "./OpenAiProviderAdapter";
import { AiProviderAdapter, GenerateChatCompletionResult } from "./aiProviderTypes";

const openAiAdapter = new OpenAiProviderAdapter();
const geminiAdapter = new GeminiProviderAdapter();

export function getAiProviderAdapter(provider: string): AiProviderAdapter {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!isAiProviderId(normalized)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Provedor de IA não suportado."
    );
  }
  return getAiProviderAdapterById(normalized);
}

export function getAiProviderAdapterById(provider: AiProviderId): AiProviderAdapter {
  if (provider === AI_PROVIDER_GEMINI) return geminiAdapter;
  return openAiAdapter;
}

export async function generateChatCompletionViaAdapter(input: {
  provider: AiProviderId;
  companyId: number;
  ticketId?: number | null;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  messages: import("openai").ChatCompletionRequestMessage[];
  timeoutMs: number;
  source: string;
  tools?: import("./aiProviderTypes").GenerateChatCompletionInput["tools"];
  geminiFunctionDeclarations?: import("./aiProviderTypes").GenerateChatCompletionInput["geminiFunctionDeclarations"];
}): Promise<GenerateChatCompletionResult> {
  const adapter = getAiProviderAdapterById(input.provider);
  return adapter.generateChatCompletion({
    companyId: input.companyId,
    ticketId: input.ticketId,
    apiKey: input.apiKey,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    systemPrompt: input.systemPrompt,
    messages: input.messages,
    timeoutMs: input.timeoutMs,
    source: input.source,
    tools: input.tools,
    geminiFunctionDeclarations: input.geminiFunctionDeclarations
  });
}
