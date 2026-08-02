import { AI_PROVIDER_OPENAI } from "../../config/aiProviderModels";
import { executeOpenAi } from "../OpenAi/OpenAiManager";
import { AI_AGENT_SHADOW_ERROR_CODES } from "../AiAgentService/aiAgentShadowErrors";
import { mapOpenAiManagerError } from "./aiProviderErrors";
import { buildOpenAiMultimodalMessages } from "./aiProviderMultimodal";
import {
  AiProviderAdapter,
  GenerateChatCompletionInput,
  GenerateChatCompletionResult
} from "./aiProviderTypes";
import { Configuration, OpenAIApi } from "openai";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("SHADOW_TIMEOUT")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export class OpenAiProviderAdapter implements AiProviderAdapter {
  readonly provider = AI_PROVIDER_OPENAI;

  async generateChatCompletion(
    input: GenerateChatCompletionInput
  ): Promise<GenerateChatCompletionResult> {
    const startedAt = Date.now();

    try {
      const messages = buildOpenAiMultimodalMessages(
        input.messages,
        input.imageParts
      );

      const result = await withTimeout(
        executeOpenAi({
          companyId: input.companyId,
          ticketId: input.ticketId,
          apiKey: input.apiKey,
          prompt: input.systemPrompt,
          messages,
          model: input.model,
          maxTokens: input.maxTokens,
          temperature: input.temperature,
          source: input.source,
          tools: input.tools
        }),
        input.timeoutMs
      );

      const latencyMs = Date.now() - startedAt;

      if (!result.ok) {
        return {
          ok: false,
          errorCode: mapOpenAiManagerError(
            "error" in result ? result.error : "OPENAI_API_ERROR"
          ),
          latencyMs
        };
      }

      const text = result.content?.trim() || "";
      const toolCalls = result.toolCalls;
      if (!text && !(toolCalls && toolCalls.length)) {
        return {
          ok: false,
          errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE,
          latencyMs
        };
      }

      return {
        ok: true,
        text,
        provider: this.provider,
        model: input.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.tokensUsed,
        latencyMs,
        toolCalls
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      if (err instanceof Error && err.message === "SHADOW_TIMEOUT") {
        return {
          ok: false,
          errorCode: AI_AGENT_SHADOW_ERROR_CODES.PROVIDER_TIMEOUT,
          latencyMs
        };
      }
      return {
        ok: false,
        errorCode: AI_AGENT_SHADOW_ERROR_CODES.GENERATION_FAILED,
        latencyMs
      };
    }
  }

  async testCredential(apiKey: string): Promise<void> {
    const openai = new OpenAIApi(new Configuration({ apiKey }));
    await openai.listModels();
  }
}

export default OpenAiProviderAdapter;
