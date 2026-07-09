import { ChatCompletionRequestMessage } from "openai";
import {
  AI_PROVIDER_GEMINI,
  resolveDefaultModelForProvider
} from "../../config/aiProviderModels";
import { AI_AGENT_SHADOW_ERROR_CODES } from "../AiAgentService/aiAgentShadowErrors";
import { mapGeminiErrorToShadowCode } from "./aiProviderErrors";
import {
  AiProviderAdapter,
  GenerateChatCompletionInput,
  GenerateChatCompletionResult
} from "./aiProviderTypes";

type GeminiRole = "user" | "model";

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

function toGeminiHistory(
  messages: ChatCompletionRequestMessage[]
): Array<{ role: GeminiRole; parts: Array<{ text: string }> }> {
  const history: Array<{ role: GeminiRole; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;
    const text = String(msg.content || "").trim();
    if (!text) continue;
    if (msg.role === "assistant") {
      history.push({ role: "model", parts: [{ text }] });
    } else if (msg.role === "user") {
      history.push({ role: "user", parts: [{ text }] });
    }
  }

  return history;
}

function extractLastUserText(messages: ChatCompletionRequestMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role === "user") {
      const text = String(msg.content || "").trim();
      if (text) return text;
    }
  }
  return "";
}

function splitGeminiConversation(messages: ChatCompletionRequestMessage[]): {
  history: Array<{ role: GeminiRole; parts: Array<{ text: string }> }>;
  lastUserText: string;
} {
  const all = toGeminiHistory(messages);
  if (all.length === 0) {
    return { history: [], lastUserText: "" };
  }

  const last = all[all.length - 1];
  if (last.role === "user") {
    return {
      history: all.slice(0, -1),
      lastUserText: last.parts[0]?.text || ""
    };
  }

  return { history: all, lastUserText: extractLastUserText(messages) };
}

export class GeminiProviderAdapter implements AiProviderAdapter {
  readonly provider = AI_PROVIDER_GEMINI;

  async generateChatCompletion(
    input: GenerateChatCompletionInput
  ): Promise<GenerateChatCompletionResult> {
    const startedAt = Date.now();
    const modelName = input.model || resolveDefaultModelForProvider(this.provider);

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(input.apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: input.systemPrompt?.trim() || undefined
      });

      const { history, lastUserText } = splitGeminiConversation(input.messages);
      if (!lastUserText) {
        return {
          ok: false,
          errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE,
          latencyMs: Date.now() - startedAt
        };
      }

      const generationConfig = {
        temperature: input.temperature,
        maxOutputTokens: input.maxTokens
      };

      const response = await withTimeout(
        history.length > 0
          ? (async () => {
              const chat = model.startChat({ history, generationConfig });
              const result = await chat.sendMessage(lastUserText);
              return result.response;
            })()
          : model.generateContent({
              contents: [{ role: "user", parts: [{ text: lastUserText }] }],
              generationConfig
            }).then((r) => r.response),
        input.timeoutMs
      );

      const text = response.text()?.trim() || "";
      const latencyMs = Date.now() - startedAt;

      if (!text) {
        return {
          ok: false,
          errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE,
          latencyMs
        };
      }

      const usage = (
        response as unknown as {
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        }
      ).usageMetadata;

      return {
        ok: true,
        text,
        provider: this.provider,
        model: modelName,
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
        latencyMs
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
        errorCode: mapGeminiErrorToShadowCode(err),
        latencyMs
      };
    }
  }

  async testCredential(apiKey: string): Promise<void> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: resolveDefaultModelForProvider(this.provider)
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Responda apenas OK" }] }],
      generationConfig: { maxOutputTokens: 8, temperature: 0 }
    });
    const text = result.response.text()?.trim();
    if (!text) {
      throw new Error("EMPTY_TEST_RESPONSE");
    }
  }
}

export default GeminiProviderAdapter;
