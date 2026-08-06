import { ChatCompletionRequestMessage } from "openai";
import { AiProviderId } from "../../config/aiProviderModels";
import { generateChatCompletionViaAdapter } from "../AiProviderService/AiProviderAdapterFactory";
import {
  AI_AGENT_VISION_FALSE_DENIAL_FALLBACK_MESSAGE,
  AI_AGENT_VISION_REGEN_INSTRUCTION,
  detectAiAgentFalseMediaCapabilityDenial
} from "./detectAiAgentFalseMediaCapabilityDenial";

export type AiAgentVisionIntegrityMeta = {
  visionFalseDenialDetected: boolean;
  visionFalseDenialRetried: boolean;
  visionFalseDenialFallback: boolean;
};

const EMPTY_META: AiAgentVisionIntegrityMeta = {
  visionFalseDenialDetected: false,
  visionFalseDenialRetried: false,
  visionFalseDenialFallback: false
};

/**
 * Quando há imageParts e o modelo nega falsamente capacidade visual:
 * 1 regeneração com instrução corretiva; se persistir → fallback determinístico.
 * No máximo uma regeneração (sem loops).
 */
export async function enforceAiAgentVisionResponseIntegrity(input: {
  hasImageParts: boolean;
  text: string;
  provider: AiProviderId;
  companyId: number;
  ticketId: number;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  messages: ChatCompletionRequestMessage[];
  timeoutMs: number;
  source: string;
  imageParts?: Array<{ mimeType: string; base64: string }>;
}): Promise<{ text: string; meta: AiAgentVisionIntegrityMeta; latencyMsExtra: number }> {
  if (!input.hasImageParts) {
    return { text: input.text, meta: { ...EMPTY_META }, latencyMsExtra: 0 };
  }

  const first = detectAiAgentFalseMediaCapabilityDenial(input.text);
  if (!first.isFalseDenial) {
    return { text: input.text, meta: { ...EMPTY_META }, latencyMsExtra: 0 };
  }

  const regenStarted = Date.now();
  const regenMessages: ChatCompletionRequestMessage[] = [
    ...input.messages.map(m => ({ ...m })),
    { role: "assistant", content: input.text },
    { role: "user", content: AI_AGENT_VISION_REGEN_INSTRUCTION }
  ];

  const regen = await generateChatCompletionViaAdapter({
    provider: input.provider,
    companyId: input.companyId,
    ticketId: input.ticketId,
    apiKey: input.apiKey,
    model: input.model,
    maxTokens: input.maxTokens,
    temperature: Math.min(Number(input.temperature) || 0.2, 0.3),
    systemPrompt: input.systemPrompt,
    messages: regenMessages,
    timeoutMs: input.timeoutMs,
    source: `${input.source}:vision_false_denial_regen`,
    imageParts: input.imageParts
  });
  const latencyMsExtra = Date.now() - regenStarted;

  if (regen.ok && regen.text?.trim()) {
    const second = detectAiAgentFalseMediaCapabilityDenial(regen.text);
    if (!second.isFalseDenial) {
      return {
        text: regen.text.trim(),
        meta: {
          visionFalseDenialDetected: true,
          visionFalseDenialRetried: true,
          visionFalseDenialFallback: false
        },
        latencyMsExtra
      };
    }
  }

  return {
    text: AI_AGENT_VISION_FALSE_DENIAL_FALLBACK_MESSAGE,
    meta: {
      visionFalseDenialDetected: true,
      visionFalseDenialRetried: true,
      visionFalseDenialFallback: true
    },
    latencyMsExtra
  };
}
