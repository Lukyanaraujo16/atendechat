import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
import { Op } from "sequelize";
import { startOfDay } from "date-fns";
import OpenAiUsage from "../../models/OpenAiUsage";
import { logger } from "../../utils/logger";

/** Máximo de chamadas à API OpenAI por empresa por dia (chat ou transcrição). */
export const OPENAI_DAILY_CALL_LIMIT = 500;

/**
 * Modelo padrão quando nenhum está configurado (Prompt no BD, nó Flow, etc.).
 * Evita fallback silencioso divergente entre módulos — sempre usar resolveOpenAiModel().
 */
export const DEFAULT_OPENAI_MODEL = "gpt-3.5-turbo-1106";

/** Corpo de erro estável para APIs futuras (limite diário). */
export const OPENAI_LIMIT_REACHED_JSON = { error: "OPENAI_LIMIT_REACHED" as const };

/** Mensagem enviada ao cliente quando `executeOpenAi` / transcrição falham ou limite é atingido. */
export const OPENAI_FALLBACK_CLIENT_MESSAGE =
  "Não consegui responder agora, tente novamente em instantes.";

/**
 * Resolve o modelo a enviar à API. String vazia/indefinida → DEFAULT_OPENAI_MODEL (com log em debug).
 */
export function resolveOpenAiModel(model?: string | null): string {
  const trimmed = typeof model === "string" ? model.trim() : "";
  if (!trimmed) {
    logger.debug(
      { fallback: DEFAULT_OPENAI_MODEL },
      "[OpenAiManager] model ausente; usando DEFAULT_OPENAI_MODEL"
    );
    return DEFAULT_OPENAI_MODEL;
  }
  return trimmed;
}

export interface ExecuteOpenAiParams {
  companyId: number;
  ticketId?: number | null;
  apiKey: string;
  /**
   * Instrução de sistema opcional. Se informado, é enviada como primeira mensagem `system`
   * antes de `messages`. Se omitido, `messages` deve conter o contexto completo (incluindo system).
   */
  prompt?: string;
  messages: ChatCompletionRequestMessage[];
  model: string;
  maxTokens: number;
  temperature: number;
  /** Origem da chamada para logs (ex.: ai_agent_shadow). */
  source?: string;
  /** Function calling opcional — ausente = chat legado. */
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

export type ExecuteOpenAiResult =
  | {
      ok: true;
      content: string;
      tokensUsed: number;
      promptTokens?: number;
      completionTokens?: number;
      toolCalls?: Array<{ id: string; name: string; arguments: string }>;
    }
  | { ok: false; error: "OPENAI_LIMIT_REACHED" }
  | { ok: false; error: "OPENAI_API_ERROR" };

export type ExecuteTranscriptionResult =
  | { ok: true; text: string; tokensUsed: number }
  | {
      ok: false;
      error: "OPENAI_LIMIT_REACHED" | "OPENAI_API_ERROR" | "OPENAI_TIMEOUT";
      httpStatus?: number | null;
      providerErrorCode?: string | null;
      timedOut?: boolean;
      errorStage?: string | null;
    };

/**
 * Sanitiza erro Axios/OpenAI para logs — sem API key, sem corpo de áudio.
 */
export function sanitizeOpenAiProviderError(err: unknown): {
  httpStatus: number | null;
  providerErrorCode: string | null;
  timedOut: boolean;
  errorStage: string;
} {
  const anyErr = err as {
    code?: string;
    message?: string;
    response?: {
      status?: number;
      data?: { error?: { code?: string; type?: string } };
    };
  };
  const httpStatus =
    typeof anyErr?.response?.status === "number"
      ? anyErr.response.status
      : null;
  const providerErrorCode =
    anyErr?.response?.data?.error?.code ||
    anyErr?.response?.data?.error?.type ||
    (typeof anyErr?.code === "string" ? anyErr.code : null);
  const msg = String(anyErr?.message || "");
  const timedOut =
    anyErr?.code === "ECONNABORTED" ||
    /timeout/i.test(msg) ||
    msg === "TRANSCRIBE_TIMEOUT";
  let errorStage = "provider_request";
  if (timedOut) errorStage = "timeout";
  else if (httpStatus === 401 || httpStatus === 403) errorStage = "auth";
  else if (httpStatus === 415 || httpStatus === 400) errorStage = "format";
  else if (/ENOENT|EACCES|EISDIR/i.test(msg)) errorStage = "local_file";
  return {
    httpStatus,
    providerErrorCode: providerErrorCode
      ? String(providerErrorCode).slice(0, 64)
      : null,
    timedOut,
    errorStage
  };
}

async function countCallsToday(companyId: number): Promise<number> {
  const start = startOfDay(new Date());
  return OpenAiUsage.count({
    where: {
      companyId,
      createdAt: {
        [Op.gte]: start
      }
    }
  });
}

/** Verifica se ainda cabem `slotsNeeded` chamadas (transcrição + chat = 2) no limite do dia. */
export async function canMakeOpenAiCalls(
  companyId: number,
  slotsNeeded: number = 1
): Promise<boolean> {
  const calls = await countCallsToday(companyId);
  return calls + slotsNeeded <= OPENAI_DAILY_CALL_LIMIT;
}

async function assertUnderLimitAndLog(
  companyId: number,
  ticketId: number | null | undefined,
  tokensUsed: number
): Promise<void> {
  await OpenAiUsage.create({
    companyId,
    ticketId: ticketId ?? null,
    tokensUsed
  });
}

function buildMessages(
  prompt: string | undefined,
  messages: ChatCompletionRequestMessage[]
): ChatCompletionRequestMessage[] {
  if (prompt) {
    return [{ role: "system", content: prompt }, ...messages];
  }
  return messages;
}

/**
 * Chat completion centralizado: limite diário, log de uso, erros sem throw.
 */
export async function executeOpenAi(params: ExecuteOpenAiParams): Promise<ExecuteOpenAiResult> {
  const {
    companyId,
    ticketId,
    apiKey,
    prompt,
    messages,
    model,
    maxTokens,
    temperature,
    source,
    tools
  } = params;

  if (!(await canMakeOpenAiCalls(companyId, 1))) {
    logger.warn(
      { companyId, ticketId, limit: OPENAI_DAILY_CALL_LIMIT, source },
      "[OpenAiManager] OPENAI_LIMIT_REACHED (chat)"
    );
    return { ok: false, error: "OPENAI_LIMIT_REACHED" };
  }

  const finalMessages = buildMessages(prompt, messages);
  const safeModel = resolveOpenAiModel(model);

  logger.info(
    {
      companyId,
      ticketId,
      model: safeModel,
      source: source ?? "legacy",
      tools: tools?.length || 0
    },
    "[OpenAiManager] chamada OpenAI (chat)"
  );

  try {
    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);

    const requestBody: Record<string, unknown> = {
      model: safeModel,
      messages: finalMessages,
      max_tokens: maxTokens,
      temperature
    };
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = "auto";
    }

    const chat = await openai.createChatCompletion(requestBody as any);

    const message = chat.data.choices[0]?.message;
    const content = message?.content ?? "";
    const rawToolCalls = (message as any)?.tool_calls;
    const toolCalls = Array.isArray(rawToolCalls)
      ? rawToolCalls
          .filter((tc: any) => tc?.function?.name)
          .map((tc: any) => ({
            id: String(tc.id || `call_${Date.now()}`),
            name: String(tc.function.name),
            arguments: String(tc.function.arguments || "{}")
          }))
      : undefined;

    const usage = chat.data.usage;
    const tokensUsed =
      usage?.total_tokens ??
      (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

    await assertUnderLimitAndLog(companyId, ticketId, tokensUsed);

    return {
      ok: true,
      content,
      tokensUsed,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      toolCalls
    };
  } catch (err) {
    logger.error(
      { err, companyId, ticketId, phase: "chat" },
      "[OpenAiManager] OPENAI_API_ERROR"
    );
    return { ok: false, error: "OPENAI_API_ERROR" };
  }
}

/**
 * Transcrição Whisper via multipart controlado.
 *
 * NÃO sobrescreve `stream.path` com basename — o form-data usa path para
 * fs.stat/open; basename relativo causa ENOENT e falha a transcrição.
 *
 * Prefira `absolutePath` (fluxo AI Agent). `file` permanece para compat legado.
 */
export async function executeOpenAiTranscription(params: {
  companyId: number;
  ticketId?: number | null;
  apiKey: string;
  /** Caminho absoluto local do áudio (recomendado). */
  absolutePath?: string;
  file?: NodeJS.ReadableStream;
  filename?: string;
  mimeType?: string;
  timeoutMs?: number;
}): Promise<ExecuteTranscriptionResult> {
  const {
    companyId,
    ticketId,
    apiKey,
    absolutePath,
    file,
    filename,
    mimeType,
    timeoutMs
  } = params;

  if (!(await canMakeOpenAiCalls(companyId, 1))) {
    logger.warn(
      { companyId, ticketId, limit: OPENAI_DAILY_CALL_LIMIT },
      "[OpenAiManager] OPENAI_LIMIT_REACHED (transcription)"
    );
    return { ok: false, error: "OPENAI_LIMIT_REACHED" };
  }

  logger.info(
    { companyId, ticketId },
    "[OpenAiManager] chamada OpenAI (transcrição Whisper)"
  );

  const FormData = (await import("form-data")).default;
  const axios = (await import("axios")).default;
  const fs = await import("fs");
  const path = await import("path");

  let stream: NodeJS.ReadableStream | null = null;
  let createdStream = false;

  try {
    const uploadName = String(
      filename ||
        (absolutePath ? path.basename(absolutePath) : "") ||
        "audio.ogg"
    ).replace(/[^\w.\-]+/g, "_");

    const contentType =
      String(mimeType || "audio/ogg")
        .split(";")[0]
        .trim() || "audio/ogg";

    let knownLength: number | undefined;
    if (absolutePath) {
      const stat = await fs.promises.stat(absolutePath);
      if (!stat.isFile() || stat.size <= 0) {
        return {
          ok: false,
          error: "OPENAI_API_ERROR",
          errorStage: "local_file",
          providerErrorCode: "EMPTY_OR_MISSING_FILE"
        };
      }
      knownLength = stat.size;
      stream = fs.createReadStream(absolutePath);
      createdStream = true;
    } else if (file) {
      stream = file;
    } else {
      return {
        ok: false,
        error: "OPENAI_API_ERROR",
        errorStage: "local_file",
        providerErrorCode: "NO_FILE_INPUT"
      };
    }

    const form = new FormData();
    form.append("file", stream as any, {
      filename: uploadName,
      contentType,
      knownLength
    });
    form.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`
        },
        timeout: timeoutMs && timeoutMs > 0 ? timeoutMs : 45_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true
      }
    );

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: "OPENAI_API_ERROR",
        httpStatus: response.status,
        providerErrorCode:
          response.data?.error?.code || response.data?.error?.type || "auth",
        errorStage: "auth"
      };
    }

    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        error: "OPENAI_API_ERROR",
        httpStatus: response.status,
        providerErrorCode:
          response.data?.error?.code ||
          response.data?.error?.type ||
          `http_${response.status}`,
        errorStage:
          response.status === 415 || response.status === 400
            ? "format"
            : "provider_request"
      };
    }

    const text =
      typeof response.data === "string"
        ? response.data
        : String(response.data?.text ?? "");

    await assertUnderLimitAndLog(companyId, ticketId, 0);

    return { ok: true, text, tokensUsed: 0 };
  } catch (err) {
    const sanitized = sanitizeOpenAiProviderError(err);
    logger.error(
      {
        companyId,
        ticketId,
        phase: "transcription",
        httpStatus: sanitized.httpStatus,
        providerErrorCode: sanitized.providerErrorCode,
        errorStage: sanitized.errorStage,
        timedOut: sanitized.timedOut
      },
      "[OpenAiManager] OPENAI_API_ERROR"
    );
    return {
      ok: false,
      error: sanitized.timedOut ? "OPENAI_TIMEOUT" : "OPENAI_API_ERROR",
      httpStatus: sanitized.httpStatus,
      providerErrorCode: sanitized.providerErrorCode,
      timedOut: sanitized.timedOut,
      errorStage: sanitized.errorStage
    };
  } finally {
    if (
      createdStream &&
      stream &&
      typeof (stream as any).destroy === "function"
    ) {
      try {
        (stream as any).destroy();
      } catch {
        /* ignore */
      }
    }
  }
}
