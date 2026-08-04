import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AI_AGENT_MEDIA_LIMITS,
  isAllowedAiAgentAudioMime,
  normalizeAiAgentMediaMimeType
} from "../../config/aiModelMediaCapabilities";
import {
  AiProviderId,
  AI_PROVIDER_GEMINI,
  AI_PROVIDER_OPENAI
} from "../../config/aiProviderModels";
import { del, get, set, setNx } from "../../libs/cache";
import { executeOpenAiTranscription } from "../OpenAi/OpenAiManager";
import { emitAiAgentMediaMetric } from "./emitAiAgentMediaMetric";
import { resolveWhisperUploadFilename } from "./resolveAiAgentLocalMediaPath";
import { logger } from "../../utils/logger";

export type TranscribeAiAgentAudioErrorCode =
  | "file_unavailable"
  | "format_unsupported"
  | "file_too_large"
  | "provider_unavailable"
  | "timeout"
  | "empty_transcription"
  | "credential_missing"
  | "model_incompatible"
  | "lock_busy";

export type TranscribeAiAgentAudioInput = {
  companyId: number;
  ticketId?: number | null;
  agentId?: number | null;
  messageId: string;
  absolutePath: string;
  mimeType: string;
  byteSize: number;
  provider: AiProviderId;
  apiKey: string;
  /** Modelo de chat do agente — usado no Gemini para STT via generateContent. */
  model: string;
  timeoutMs?: number;
};

export type TranscribeAiAgentAudioResult =
  | {
      ok: true;
      text: string;
      cached: boolean;
      durationMs: number;
      provider: AiProviderId;
    }
  | {
      ok: false;
      errorCode: TranscribeAiAgentAudioErrorCode;
      durationMs: number;
    };

function cacheKey(companyId: number, messageId: string): string {
  return `ai-agent:transcribe:${companyId}:${messageId}`;
}

function lockKey(companyId: number, messageId: string): string {
  return `ai-agent:transcribe:lock:${companyId}:${messageId}`;
}

function normalizeTranscription(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TRANSCRIBE_TIMEOUT")), ms);
    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function transcribeWithOpenAi(input: {
  companyId: number;
  ticketId?: number | null;
  apiKey: string;
  absolutePath: string;
  mimeType: string;
}): Promise<
  | { ok: true; text: string }
  | { ok: false; errorCode: TranscribeAiAgentAudioErrorCode }
> {
  const stream = fs.createReadStream(input.absolutePath);
  const filename = resolveWhisperUploadFilename(
    input.absolutePath,
    input.mimeType
  );
  try {
    const result = await executeOpenAiTranscription({
      companyId: input.companyId,
      ticketId: input.ticketId,
      apiKey: input.apiKey,
      file: stream,
      filename
    });
    if (!result.ok) {
      return {
        ok: false,
        errorCode: "provider_unavailable"
      };
    }
    const text = normalizeTranscription(result.text);
    if (!text) return { ok: false, errorCode: "empty_transcription" };
    return { ok: true, text };
  } finally {
    await new Promise<void>(resolve => {
      const done = () => resolve();
      stream.once("close", done);
      stream.once("error", done);
      stream.destroy();
    });
  }
}

async function transcribeWithGemini(input: {
  apiKey: string;
  model: string;
  absolutePath: string;
  mimeType: string;
}): Promise<
  | { ok: true; text: string }
  | { ok: false; errorCode: TranscribeAiAgentAudioErrorCode }
> {
  const buffer = await fs.promises.readFile(input.absolutePath);
  const genAI = new GoogleGenerativeAI(input.apiKey);
  const model = genAI.getGenerativeModel({ model: input.model });
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Transcreva fielmente o áudio em texto corrido. " +
              "Retorne apenas a transcrição, sem comentários, aspas ou prefixos. " +
              "Se não houver fala compreensível, retorne exatamente: [INAUDIVEL]"
          },
          {
            inlineData: {
              mimeType: input.mimeType,
              data: buffer.toString("base64")
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024
    }
  });
  const text = normalizeTranscription(result.response.text() || "");
  if (!text || text === "[INAUDIVEL]") {
    return { ok: false, errorCode: "empty_transcription" };
  }
  return { ok: true, text };
}

/**
 * Transcrição central do AI Agent.
 * Idempotente por companyId+messageId (Redis). Não persiste no Message.body.
 */
export async function TranscribeAiAgentAudioService(
  input: TranscribeAiAgentAudioInput
): Promise<TranscribeAiAgentAudioResult> {
  const startedAt = Date.now();
  const timeoutMs =
    input.timeoutMs ?? AI_AGENT_MEDIA_LIMITS.transcriptionTimeoutMs;

  emitAiAgentMediaMetric("ai_agent.audio_transcription_started", {
    companyId: input.companyId,
    agentId: input.agentId,
    ticketId: input.ticketId,
    messageId: input.messageId,
    provider: input.provider,
    model: input.model,
    mediaType: "audio",
    byteSize: input.byteSize
  });

  if (!input.apiKey) {
    const durationMs = Date.now() - startedAt;
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      model: input.model,
      mediaType: "audio",
      byteSize: input.byteSize,
      durationMs,
      errorCode: "credential_missing"
    });
    return { ok: false, errorCode: "credential_missing", durationMs };
  }

  const mime = normalizeAiAgentMediaMimeType(input.mimeType);
  if (!isAllowedAiAgentAudioMime(mime)) {
    const durationMs = Date.now() - startedAt;
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      mediaType: "audio",
      byteSize: input.byteSize,
      durationMs,
      errorCode: "format_unsupported"
    });
    return { ok: false, errorCode: "format_unsupported", durationMs };
  }

  if (
    !Number.isFinite(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > AI_AGENT_MEDIA_LIMITS.maxAudioBytes
  ) {
    const durationMs = Date.now() - startedAt;
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      mediaType: "audio",
      byteSize: input.byteSize,
      durationMs,
      errorCode: "file_too_large"
    });
    return { ok: false, errorCode: "file_too_large", durationMs };
  }

  try {
    await fs.promises.access(input.absolutePath, fs.constants.R_OK);
  } catch {
    const durationMs = Date.now() - startedAt;
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      mediaType: "audio",
      byteSize: input.byteSize,
      durationMs,
      errorCode: "file_unavailable"
    });
    return { ok: false, errorCode: "file_unavailable", durationMs };
  }

  const cKey = cacheKey(input.companyId, input.messageId);
  try {
    const cached = await get(cKey);
    if (cached && String(cached).trim()) {
      const text = normalizeTranscription(String(cached));
      const durationMs = Date.now() - startedAt;
      emitAiAgentMediaMetric("ai_agent.audio_transcription_completed", {
        companyId: input.companyId,
        agentId: input.agentId,
        ticketId: input.ticketId,
        messageId: input.messageId,
        provider: input.provider,
        model: input.model,
        mediaType: "audio",
        byteSize: input.byteSize,
        durationMs,
        result: "cached"
      });
      return {
        ok: true,
        text,
        cached: true,
        durationMs,
        provider: input.provider
      };
    }
  } catch {
    // fail-open
  }

  const lKey = lockKey(input.companyId, input.messageId);
  let lockAcquired = false;
  try {
    lockAcquired = await setNx(
      lKey,
      String(Date.now()),
      AI_AGENT_MEDIA_LIMITS.transcriptionLockTtlSeconds
    );
  } catch {
    lockAcquired = true; // fail-open
  }

  if (!lockAcquired) {
    // Outra instância pode estar transcrevendo — aguardar cache breve
    const waitOnce = (): Promise<string | null> =>
      new Promise(resolve => {
        setTimeout(() => {
          get(cKey)
            .then(v => resolve(v ? String(v) : null))
            .catch(() => resolve(null));
        }, 400);
      });

    const cachedHits = await Promise.all([
      waitOnce(),
      waitOnce(),
      waitOnce(),
      waitOnce()
    ]);
    const cachedHit = cachedHits.find(v => v && String(v).trim());
    if (cachedHit) {
      const text = normalizeTranscription(String(cachedHit));
      const durationMs = Date.now() - startedAt;
      return {
        ok: true,
        text,
        cached: true,
        durationMs,
        provider: input.provider
      };
    }
    const durationMs = Date.now() - startedAt;
    return { ok: false, errorCode: "lock_busy", durationMs };
  }

  try {
    let work: Promise<
      | { ok: true; text: string }
      | { ok: false; errorCode: TranscribeAiAgentAudioErrorCode }
    >;
    if (input.provider === AI_PROVIDER_OPENAI) {
      work = transcribeWithOpenAi({
        companyId: input.companyId,
        ticketId: input.ticketId,
        apiKey: input.apiKey,
        absolutePath: input.absolutePath,
        mimeType: mime
      });
    } else if (input.provider === AI_PROVIDER_GEMINI) {
      work = transcribeWithGemini({
        apiKey: input.apiKey,
        model: input.model,
        absolutePath: input.absolutePath,
        mimeType: mime
      });
    } else {
      work = Promise.resolve({
        ok: false as const,
        errorCode: "model_incompatible" as const
      });
    }

    const result = await withTimeout(work, timeoutMs);
    const durationMs = Date.now() - startedAt;

    if (result.ok === false) {
      emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
        companyId: input.companyId,
        agentId: input.agentId,
        ticketId: input.ticketId,
        messageId: input.messageId,
        provider: input.provider,
        model: input.model,
        mediaType: "audio",
        byteSize: input.byteSize,
        durationMs,
        errorCode: result.errorCode
      });
      return { ok: false, errorCode: result.errorCode, durationMs };
    }

    try {
      await set(
        cKey,
        result.text,
        "EX",
        AI_AGENT_MEDIA_LIMITS.transcriptionCacheTtlSeconds
      );
    } catch {
      // cache opcional
    }

    emitAiAgentMediaMetric("ai_agent.audio_transcription_completed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      model: input.model,
      mediaType: "audio",
      byteSize: input.byteSize,
      durationMs,
      result: "ok"
    });

    return {
      ok: true,
      text: result.text,
      cached: false,
      durationMs,
      provider: input.provider
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const isTimeout =
      err instanceof Error && err.message === "TRANSCRIBE_TIMEOUT";
    const errorCode: TranscribeAiAgentAudioErrorCode = isTimeout
      ? "timeout"
      : "provider_unavailable";
    logger.warn(
      {
        companyId: input.companyId,
        ticketId: input.ticketId,
        messageId: input.messageId,
        provider: input.provider,
        errorCode
      },
      "[AiAgent][media] transcription_error"
    );
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      model: input.model,
      mediaType: "audio",
      byteSize: input.byteSize,
      durationMs,
      errorCode
    });
    return { ok: false, errorCode, durationMs };
  } finally {
    try {
      await del(lKey);
    } catch {
      // TTL
    }
  }
}

export default TranscribeAiAgentAudioService;
