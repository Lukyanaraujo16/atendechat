/**
 * Capability registry multimodal por modelo/provider (Fase 2.17).
 * Derivado da allowlist real — não espalhar if (model === ...) no runtime.
 */
import {
  AI_PROVIDER_GEMINI,
  AI_PROVIDER_OPENAI,
  AiProviderId,
  GEMINI_MODELS,
  OPENAI_MODELS,
  isAiProviderId,
  isModelAllowedForProvider
} from "./aiProviderModels";

export type AiModelMediaCapabilities = {
  supportsText: boolean;
  supportsVision: boolean;
  /** Transcrição via endpoint/capacidade separada do mesmo provider. */
  supportsAudioTranscription: boolean;
  /** Áudio nativo no chat completion (não usado nesta fase). */
  supportsNativeAudio: boolean;
};

const OPENAI_VISION_MODELS = new Set<string>(["gpt-4o-mini", "gpt-4o"]);

/** gpt-3.5 não tem visão; Whisper é capacidade do provider OpenAI, não do modelo de chat. */
const OPENAI_NO_VISION = new Set<string>(["gpt-3.5-turbo-1106"]);

const CAPABILITY_BY_MODEL: Record<string, AiModelMediaCapabilities> = {
  ...Object.fromEntries(
    OPENAI_MODELS.map(model => [
      model,
      {
        supportsText: true,
        supportsVision: OPENAI_VISION_MODELS.has(model),
        supportsAudioTranscription: true,
        supportsNativeAudio: false
      } satisfies AiModelMediaCapabilities
    ])
  ),
  ...Object.fromEntries(
    GEMINI_MODELS.map(model => [
      model,
      {
        supportsText: true,
        supportsVision: true,
        supportsAudioTranscription: true,
        supportsNativeAudio: false
      } satisfies AiModelMediaCapabilities
    ])
  )
};

export const AI_AGENT_MEDIA_LIMITS = {
  maxAudioBytes: 25 * 1024 * 1024,
  maxImageBytes: 4 * 1024 * 1024,
  maxImagesPerTurn: 3,
  maxTotalAttachmentBytes: 28 * 1024 * 1024,
  transcriptionTimeoutMs: 45_000,
  visionTimeoutMs: 60_000,
  transcriptionCacheTtlSeconds: 3600,
  transcriptionLockTtlSeconds: 90
} as const;

export const AI_AGENT_AUDIO_MIME_TYPES = new Set([
  "audio/ogg",
  "audio/opus",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/aac"
]);

export const AI_AGENT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
]);

export function resolveAiModelMediaCapabilities(
  provider: string | null | undefined,
  model: string | null | undefined
): AiModelMediaCapabilities {
  const p = String(provider || "")
    .trim()
    .toLowerCase();
  const m = String(model || "").trim();

  if (!isAiProviderId(p) || !m || !isModelAllowedForProvider(m, p)) {
    return {
      supportsText: true,
      supportsVision: false,
      supportsAudioTranscription: false,
      supportsNativeAudio: false
    };
  }

  const known = CAPABILITY_BY_MODEL[m];
  if (known) return { ...known };

  // Fallback conservador por provider
  if (p === AI_PROVIDER_OPENAI) {
    return {
      supportsText: true,
      supportsVision: !OPENAI_NO_VISION.has(m),
      supportsAudioTranscription: true,
      supportsNativeAudio: false
    };
  }
  if (p === AI_PROVIDER_GEMINI) {
    return {
      supportsText: true,
      supportsVision: true,
      supportsAudioTranscription: true,
      supportsNativeAudio: false
    };
  }
  return {
    supportsText: true,
    supportsVision: false,
    supportsAudioTranscription: false,
    supportsNativeAudio: false
  };
}

export function listModelMediaCapabilitiesForProvider(
  provider: AiProviderId
): Array<{ model: string; capabilities: AiModelMediaCapabilities }> {
  let models: readonly string[] = [];
  if (provider === AI_PROVIDER_OPENAI) {
    models = OPENAI_MODELS;
  } else if (provider === AI_PROVIDER_GEMINI) {
    models = GEMINI_MODELS;
  }
  return models.map(model => ({
    model,
    capabilities: resolveAiModelMediaCapabilities(provider, model)
  }));
}

export type AiAgentMediaReadiness = {
  text: "ready" | "unavailable";
  vision: "ready" | "unavailable";
  audioTranscription: "ready" | "unavailable";
  reason?: {
    vision?: string | null;
    audioTranscription?: string | null;
  };
};

export function buildAiAgentMediaReadiness(input: {
  provider: string | null | undefined;
  model: string | null | undefined;
  hasCredential: boolean;
}): AiAgentMediaReadiness {
  if (!input.hasCredential) {
    return {
      text: "unavailable",
      vision: "unavailable",
      audioTranscription: "unavailable",
      reason: {
        vision: "credential_missing",
        audioTranscription: "credential_missing"
      }
    };
  }
  const caps = resolveAiModelMediaCapabilities(input.provider, input.model);
  return {
    text: caps.supportsText ? "ready" : "unavailable",
    vision: caps.supportsVision ? "ready" : "unavailable",
    audioTranscription: caps.supportsAudioTranscription
      ? "ready"
      : "unavailable",
    reason: {
      vision: caps.supportsVision ? null : "model_incompatible",
      audioTranscription: caps.supportsAudioTranscription
        ? null
        : "model_incompatible"
    }
  };
}
