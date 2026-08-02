/**
 * Helpers para montar parts multimodais nos adapters OpenAI/Gemini.
 */
import { ChatCompletionRequestMessage } from "openai";
import { GenerateChatCompletionImagePart } from "./aiProviderTypes";

export type OpenAiVisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function buildOpenAiMultimodalMessages(
  messages: ChatCompletionRequestMessage[],
  imageParts?: GenerateChatCompletionImagePart[]
): ChatCompletionRequestMessage[] {
  if (!imageParts || imageParts.length === 0) {
    return messages;
  }

  const cloned = messages.map(m => ({ ...m }));
  const lastUserIndex = [...cloned]
    .map((m, idx) => ({ role: m.role, idx }))
    .reverse()
    .find(row => row.role === "user")?.idx;

  if (lastUserIndex == null) {
    return cloned;
  }

  const text = String(cloned[lastUserIndex].content || "");
  const parts: OpenAiVisionContentPart[] = [
    { type: "text", text: text || "Analise a imagem enviada pelo cliente." },
    ...imageParts.slice(0, 3).map(img => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`
      }
    }))
  ];

  // SDK openai@3 tipa content como string; cast controlado para vision.
  cloned[lastUserIndex] = {
    ...cloned[lastUserIndex],
    content: parts as unknown as string
  };
  return cloned;
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export function buildGeminiUserParts(
  text: string,
  imageParts?: GenerateChatCompletionImagePart[]
): GeminiPart[] {
  const parts: GeminiPart[] = [
    { text: text || "Analise a imagem enviada pelo cliente." }
  ];
  if (!imageParts || imageParts.length === 0) return parts;
  return [
    ...parts,
    ...imageParts.slice(0, 3).map(img => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64
      }
    }))
  ];
}
