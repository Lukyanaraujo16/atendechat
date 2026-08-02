import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatCompletionRequestMessage } from "openai";
import {
  AI_PROVIDER_GEMINI,
  resolveDefaultModelForProvider
} from "../../config/aiProviderModels";
import { AI_AGENT_SHADOW_ERROR_CODES } from "../AiAgentService/aiAgentShadowErrors";
import { mapGeminiErrorToShadowCode } from "./aiProviderErrors";
import {
  GeminiPart,
  buildGeminiUserParts
} from "./aiProviderMultimodal";
import {
  AiProviderAdapter,
  GenerateChatCompletionImagePart,
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

function splitGeminiConversation(
  messages: ChatCompletionRequestMessage[],
  imageParts?: GenerateChatCompletionImagePart[]
): {
  history: Array<{ role: GeminiRole; parts: Array<{ text: string }> }>;
  lastUserParts: GeminiPart[];
} {
  const all = toGeminiHistory(messages);
  if (all.length === 0) {
    return {
      history: [],
      lastUserParts: buildGeminiUserParts("", imageParts)
    };
  }

  const last = all[all.length - 1];
  if (last.role === "user") {
    return {
      history: all.slice(0, -1),
      lastUserParts: buildGeminiUserParts(last.parts[0]?.text || "", imageParts)
    };
  }

  return {
    history: all,
    lastUserParts: buildGeminiUserParts(
      extractLastUserText(messages),
      imageParts
    )
  };
}

export class GeminiProviderAdapter implements AiProviderAdapter {
  readonly provider = AI_PROVIDER_GEMINI;

  async generateChatCompletion(
    input: GenerateChatCompletionInput
  ): Promise<GenerateChatCompletionResult> {
    const startedAt = Date.now();
    const modelName = input.model || resolveDefaultModelForProvider(this.provider);

    try {
      const genAI = new GoogleGenerativeAI(input.apiKey);
      const modelConfig: Record<string, unknown> = {
        model: modelName,
        systemInstruction: input.systemPrompt?.trim() || undefined
      };
      if (
        input.geminiFunctionDeclarations &&
        input.geminiFunctionDeclarations.length > 0
      ) {
        modelConfig.tools = [
          {
            functionDeclarations: input.geminiFunctionDeclarations.map(fd => ({
              name: fd.name,
              description: fd.description,
              parameters: fd.parameters
            }))
          }
        ];
      }

      const model = genAI.getGenerativeModel(modelConfig as any);

      const { history, lastUserParts } = splitGeminiConversation(
        input.messages,
        input.imageParts
      );
      const hasText = lastUserParts.some(
        p => "text" in p && String(p.text || "").trim()
      );
      const hasImage = lastUserParts.some(p => "inlineData" in p);
      if (!hasText && !hasImage) {
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

      const response = await withTimeout<any>(
        history.length > 0
          ? (async () => {
              const chat = model.startChat({ history, generationConfig });
              const result = await chat.sendMessage(lastUserParts as any);
              return result.response;
            })()
          : model
              .generateContent({
                contents: [{ role: "user", parts: lastUserParts }],
                generationConfig
              })
              .then((r: any) => r.response),
        input.timeoutMs
      );

      const text = (typeof response.text === "function"
        ? response.text()
        : ""
      )?.trim() || "";
      const latencyMs = Date.now() - startedAt;

      const toolCalls: Array<{ id: string; name: string; arguments: string }> =
        [];
      const parts =
        response?.candidates?.[0]?.content?.parts ||
        response?.functionCalls?.() ||
        [];
      const partList = Array.isArray(parts) ? parts : [];
      for (const part of partList) {
        const fc = part?.functionCall;
        if (fc?.name) {
          toolCalls.push({
            id: `gemini_${fc.name}_${toolCalls.length}`,
            name: String(fc.name),
            arguments: JSON.stringify(fc.args || {})
          });
        }
      }

      if (!text && !toolCalls.length) {
        return {
          ok: false,
          errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE,
          latencyMs
        };
      }

      const usage = response.usageMetadata;

      return {
        ok: true,
        text,
        provider: this.provider,
        model: modelName,
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
        latencyMs,
        toolCalls: toolCalls.length ? toolCalls : undefined
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
