import { ChatCompletionRequestMessage } from "openai";
import { AiProviderId } from "../../config/aiProviderModels";
import { AiAgentShadowErrorCode } from "../AiAgentService/aiAgentShadowErrors";

export type GenerateChatCompletionInput = {
  companyId: number;
  ticketId?: number | null;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  messages: ChatCompletionRequestMessage[];
  timeoutMs: number;
  source: string;
};

export type GenerateChatCompletionSuccess = {
  ok: true;
  text: string;
  provider: AiProviderId;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
};

export type GenerateChatCompletionFailure = {
  ok: false;
  errorCode: AiAgentShadowErrorCode;
  latencyMs: number;
};

export type GenerateChatCompletionResult =
  | GenerateChatCompletionSuccess
  | GenerateChatCompletionFailure;

export interface AiProviderAdapter {
  readonly provider: AiProviderId;
  generateChatCompletion(
    input: GenerateChatCompletionInput
  ): Promise<GenerateChatCompletionResult>;
  testCredential(apiKey: string): Promise<void>;
}
