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
import {
  AI_AGENT_AUDIO_TECHNICAL_CODES,
  AiAgentAudioTechnicalCode,
  mapHttpStatusToTechnicalCode,
  mapLegacyTranscribeErrorToTechnicalCode
} from "./aiAgentAudioTechnicalCodes";
import { emitAiAgentMediaMetric } from "./emitAiAgentMediaMetric";
import { inspectAiAgentAudioFile } from "./inspectAiAgentAudioFile";
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
      technicalCode: typeof AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_SUCCESS;
    }
  | {
      ok: false;
      errorCode: TranscribeAiAgentAudioErrorCode;
      technicalCode: AiAgentAudioTechnicalCode;
      durationMs: number;
      httpStatus?: number | null;
      providerErrorCode?: string | null;
      errorStage?: string | null;
      timedOut?: boolean;
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

function fail(
  errorCode: TranscribeAiAgentAudioErrorCode,
  durationMs: number,
  extra?: Partial<Extract<TranscribeAiAgentAudioResult, { ok: false }>>
): Extract<TranscribeAiAgentAudioResult, { ok: false }> {
  return {
    ok: false,
    errorCode,
    technicalCode:
      extra?.technicalCode ||
      mapLegacyTranscribeErrorToTechnicalCode(errorCode),
    durationMs,
    httpStatus: extra?.httpStatus ?? null,
    providerErrorCode: extra?.providerErrorCode ?? null,
    errorStage: extra?.errorStage ?? null,
    timedOut: extra?.timedOut === true
  };
}

async function transcribeWithOpenAi(input: {
  companyId: number;
  ticketId?: number | null;
  apiKey: string;
  absolutePath: string;
  mimeType: string;
  filename: string;
  timeoutMs: number;
}): Promise<
  | { ok: true; text: string }
  | {
      ok: false;
      errorCode: TranscribeAiAgentAudioErrorCode;
      technicalCode: AiAgentAudioTechnicalCode;
      httpStatus?: number | null;
      providerErrorCode?: string | null;
      errorStage?: string | null;
      timedOut?: boolean;
    }
> {
  const result = await executeOpenAiTranscription({
    companyId: input.companyId,
    ticketId: input.ticketId,
    apiKey: input.apiKey,
    absolutePath: input.absolutePath,
    filename: input.filename,
    mimeType: input.mimeType,
    timeoutMs: input.timeoutMs
  });
  if (result.ok === false) {
    if (result.error === "OPENAI_TIMEOUT" || result.timedOut) {
      return {
        ok: false,
        errorCode: "timeout",
        technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_TIMEOUT,
        httpStatus: result.httpStatus,
        providerErrorCode: result.providerErrorCode,
        errorStage: result.errorStage || "timeout",
        timedOut: true
      };
    }
    const fromHttp = mapHttpStatusToTechnicalCode(result.httpStatus);
    return {
      ok: false,
      errorCode:
        result.httpStatus === 401 || result.httpStatus === 403
          ? "credential_missing"
          : result.errorStage === "format"
            ? "format_unsupported"
            : "provider_unavailable",
      technicalCode:
        fromHttp || AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_REQUEST_FAILED,
      httpStatus: result.httpStatus,
      providerErrorCode: result.providerErrorCode,
      errorStage: result.errorStage,
      timedOut: result.timedOut
    };
  }
  const text = normalizeTranscription(result.text);
  if (!text) {
    return {
      ok: false,
      errorCode: "empty_transcription",
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_EMPTY,
      errorStage: "empty_response"
    };
  }
  return { ok: true, text };
}

async function transcribeWithGemini(input: {
  apiKey: string;
  model: string;
  absolutePath: string;
  mimeType: string;
}): Promise<
  | { ok: true; text: string }
  | {
      ok: false;
      errorCode: TranscribeAiAgentAudioErrorCode;
      technicalCode: AiAgentAudioTechnicalCode;
      providerErrorCode?: string | null;
      errorStage?: string | null;
    }
> {
  const buffer = await fs.promises.readFile(input.absolutePath);
  if (!buffer.length) {
    return {
      ok: false,
      errorCode: "file_unavailable",
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.FILE_EMPTY,
      errorStage: "local_file"
    };
  }
  const genAI = new GoogleGenerativeAI(input.apiKey);
  const model = genAI.getGenerativeModel({ model: input.model });
  try {
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
    const raw =
      typeof result.response?.text === "function"
        ? result.response.text()
        : "";
    const text = normalizeTranscription(raw || "");
    if (!text || text === "[INAUDIVEL]") {
      return {
        ok: false,
        errorCode: "empty_transcription",
        technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_EMPTY,
        errorStage: "empty_response"
      };
    }
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const auth = /API_KEY|PERMISSION|401|403|UNAUTHENTICATED/i.test(msg);
    return {
      ok: false,
      errorCode: auth ? "credential_missing" : "provider_unavailable",
      technicalCode: auth
        ? AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_AUTH_FAILED
        : AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_REQUEST_FAILED,
      providerErrorCode: msg.slice(0, 64),
      errorStage: auth ? "auth" : "provider_request"
    };
  }
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
    transcriptionModel:
      input.provider === AI_PROVIDER_OPENAI ? "whisper-1" : input.model,
    mediaType: "audio",
    byteSize: input.byteSize
  });

  if (!input.apiKey) {
    const durationMs = Date.now() - startedAt;
    const failed = fail("credential_missing", durationMs, {
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_CREDENTIAL_MISSING,
      errorStage: "credential"
    });
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
      errorCode: failed.errorCode,
      technicalCode: failed.technicalCode,
      errorStage: failed.errorStage
    });
    return failed;
  }

  const inspection = await inspectAiAgentAudioFile({
    absolutePath: input.absolutePath,
    mimeHint: input.mimeType
  });

  emitAiAgentMediaMetric("ai_agent.audio_file_resolved", {
    companyId: input.companyId,
    agentId: input.agentId,
    ticketId: input.ticketId,
    messageId: input.messageId,
    provider: input.provider,
    model: input.model,
    mediaType: "audio",
    byteSize: inspection.byteSize,
    normalizedMimeType: inspection.normalizedMimeType,
    detectedExtension: inspection.extension,
    detectedContainer: inspection.container,
    magicHex: inspection.magicHex,
    result: inspection.readable && inspection.byteSize > 0 ? "ok" : "invalid"
  });

  if (!inspection.exists || !inspection.isFile || !inspection.readable) {
    const durationMs = Date.now() - startedAt;
    const failed = fail("file_unavailable", durationMs, {
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.FILE_MISSING,
      errorStage: "local_file"
    });
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      mediaType: "audio",
      byteSize: input.byteSize,
      durationMs,
      errorCode: failed.errorCode,
      technicalCode: failed.technicalCode,
      errorStage: failed.errorStage,
      detectedExtension: inspection.extension,
      detectedContainer: inspection.container
    });
    return failed;
  }

  if (inspection.byteSize <= 0) {
    const durationMs = Date.now() - startedAt;
    const failed = fail("file_unavailable", durationMs, {
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.FILE_EMPTY,
      errorStage: "local_file"
    });
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      mediaType: "audio",
      byteSize: 0,
      durationMs,
      errorCode: failed.errorCode,
      technicalCode: failed.technicalCode,
      errorStage: failed.errorStage
    });
    return failed;
  }

  const mime = normalizeAiAgentMediaMimeType(
    inspection.normalizedMimeType || input.mimeType
  );
  if (!isAllowedAiAgentAudioMime(mime)) {
    const durationMs = Date.now() - startedAt;
    const failed = fail("format_unsupported", durationMs, {
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.FORMAT_INVALID,
      errorStage: "format"
    });
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      mediaType: "audio",
      byteSize: inspection.byteSize,
      durationMs,
      errorCode: failed.errorCode,
      technicalCode: failed.technicalCode,
      normalizedMimeType: mime,
      detectedContainer: inspection.container,
      errorStage: failed.errorStage
    });
    return failed;
  }

  if (
    !Number.isFinite(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > AI_AGENT_MEDIA_LIMITS.maxAudioBytes ||
    inspection.byteSize > AI_AGENT_MEDIA_LIMITS.maxAudioBytes
  ) {
    const durationMs = Date.now() - startedAt;
    const empty = input.byteSize <= 0 || inspection.byteSize <= 0;
    const failed = fail(empty ? "file_unavailable" : "file_too_large", durationMs, {
      technicalCode: empty
        ? AI_AGENT_AUDIO_TECHNICAL_CODES.FILE_EMPTY
        : AI_AGENT_AUDIO_TECHNICAL_CODES.FORMAT_INVALID,
      errorStage: "size"
    });
    emitAiAgentMediaMetric("ai_agent.audio_transcription_failed", {
      companyId: input.companyId,
      agentId: input.agentId,
      ticketId: input.ticketId,
      messageId: input.messageId,
      provider: input.provider,
      mediaType: "audio",
      byteSize: Math.max(input.byteSize || 0, inspection.byteSize || 0),
      durationMs,
      errorCode: failed.errorCode,
      technicalCode: failed.technicalCode,
      errorStage: failed.errorStage
    });
    return failed;
  }

  // Container desconhecido com extensão de áudio: ainda tenta provider, mas registra.
  if (inspection.container === "unknown") {
    logger.warn(
      {
        companyId: input.companyId,
        ticketId: input.ticketId,
        messageId: input.messageId,
        extension: inspection.extension,
        magicHex: inspection.magicHex,
        normalizedMimeType: mime
      },
      "[AiAgent][media] audio_container_unknown"
    );
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
        byteSize: inspection.byteSize,
        durationMs,
        result: "cached",
        technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_SUCCESS
      });
      return {
        ok: true,
        text,
        cached: true,
        durationMs,
        provider: input.provider,
        technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_SUCCESS
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
        provider: input.provider,
        technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_SUCCESS
      };
    }
    const durationMs = Date.now() - startedAt;
    return fail("lock_busy", durationMs, {
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.LOCK_BUSY,
      errorStage: "lock"
    });
  }

  const whisperFilename = resolveWhisperUploadFilename(
    input.absolutePath,
    mime
  );

  try {
    let work: Promise<
      | { ok: true; text: string }
      | {
          ok: false;
          errorCode: TranscribeAiAgentAudioErrorCode;
          technicalCode: AiAgentAudioTechnicalCode;
          httpStatus?: number | null;
          providerErrorCode?: string | null;
          errorStage?: string | null;
          timedOut?: boolean;
        }
    >;
    if (input.provider === AI_PROVIDER_OPENAI) {
      work = transcribeWithOpenAi({
        companyId: input.companyId,
        ticketId: input.ticketId,
        apiKey: input.apiKey,
        absolutePath: input.absolutePath,
        mimeType: mime,
        filename: whisperFilename,
        timeoutMs
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
        errorCode: "model_incompatible" as const,
        technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_REQUEST_FAILED,
        errorStage: "provider"
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
        transcriptionModel:
          input.provider === AI_PROVIDER_OPENAI ? "whisper-1" : input.model,
        mediaType: "audio",
        byteSize: inspection.byteSize,
        durationMs,
        errorCode: result.errorCode,
        technicalCode: result.technicalCode,
        normalizedMimeType: mime,
        detectedExtension: inspection.extension,
        detectedContainer: inspection.container,
        httpStatus: result.httpStatus,
        providerErrorCode: result.providerErrorCode,
        errorStage: result.errorStage,
        timedOut: result.timedOut === true
      });
      return fail(result.errorCode, durationMs, result);
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
      transcriptionModel:
        input.provider === AI_PROVIDER_OPENAI ? "whisper-1" : input.model,
      mediaType: "audio",
      byteSize: inspection.byteSize,
      durationMs,
      result: "ok",
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_SUCCESS,
      normalizedMimeType: mime,
      detectedExtension: inspection.extension,
      detectedContainer: inspection.container
    });

    return {
      ok: true,
      text: result.text,
      cached: false,
      durationMs,
      provider: input.provider,
      technicalCode: AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_SUCCESS
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const isTimeout =
      err instanceof Error && err.message === "TRANSCRIBE_TIMEOUT";
    const errorCode: TranscribeAiAgentAudioErrorCode = isTimeout
      ? "timeout"
      : "provider_unavailable";
    const technicalCode = isTimeout
      ? AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_TIMEOUT
      : AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_REQUEST_FAILED;
    logger.warn(
      {
        companyId: input.companyId,
        ticketId: input.ticketId,
        messageId: input.messageId,
        provider: input.provider,
        errorCode,
        technicalCode,
        timedOut: isTimeout
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
      byteSize: inspection.byteSize,
      durationMs,
      errorCode,
      technicalCode,
      timedOut: isTimeout,
      errorStage: isTimeout ? "timeout" : "provider_request",
      normalizedMimeType: mime,
      detectedExtension: inspection.extension,
      detectedContainer: inspection.container
    });
    return fail(errorCode, durationMs, {
      technicalCode,
      timedOut: isTimeout,
      errorStage: isTimeout ? "timeout" : "provider_request"
    });
  } finally {
    try {
      await del(lKey);
    } catch {
      // TTL
    }
  }
}

export default TranscribeAiAgentAudioService;
