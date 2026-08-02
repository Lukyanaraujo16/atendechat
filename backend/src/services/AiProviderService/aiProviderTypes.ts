import { ChatCompletionRequestMessage } from "openai";
import { AiProviderId } from "../../config/aiProviderModels";
import { AiAgentShadowErrorCode } from "../AiAgentService/aiAgentShadowErrors";

export type GenerateChatCompletionImagePart = {
  mimeType: string;
  /** Base64 sem prefixo data: — nunca logar. */
  base64: string;
};

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
  /** Imagens do turno atual (visão). Opcional. */
  imageParts?: GenerateChatCompletionImagePart[];
  /** Function calling — opcional; ausente = comportamento legado (Live/Shadow). */
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  geminiFunctionDeclarations?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
};

export type ProviderToolCallResult = {
  id: string;
  name: string;
  arguments: string;
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
  toolCalls?: ProviderToolCallResult[];
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
