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
  | { ok: false; error: "OPENAI_LIMIT_REACHED" }
  | { ok: false; error: "OPENAI_API_ERROR" };

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
 * Transcrição Whisper: conta como 1 chamada no limite diário.
 * `filename` opcional garante extensão reconhecida pelo Whisper no multipart
 * (ex.: áudio WhatsApp salvo como `.oga` ou sem extensão útil).
 */
export async function executeOpenAiTranscription(params: {
  companyId: number;
  ticketId?: number | null;
  apiKey: string;
  file: NodeJS.ReadableStream;
  filename?: string;
}): Promise<ExecuteTranscriptionResult> {
  const { companyId, ticketId, apiKey, file, filename } = params;

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

  try {
    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);

    if (filename && file && typeof file === "object") {
      // form-data usa stream.path (basename) como filename do multipart.
      // Não reabre o arquivo — só altera o nome enviado à API.
      try {
        Object.defineProperty(file, "path", {
          value: filename,
          writable: true,
          configurable: true
        });
      } catch {
        (file as { path?: string }).path = filename;
      }
    }

    const transcription = await openai.createTranscription(
      file as any,
      "whisper-1"
    );
    const text = transcription.data.text ?? "";

    await assertUnderLimitAndLog(companyId, ticketId, 0);

    return { ok: true, text, tokensUsed: 0 };
  } catch (err) {
    logger.error(
      { err, companyId, ticketId, phase: "transcription" },
      "[OpenAiManager] OPENAI_API_ERROR"
    );
    return { ok: false, error: "OPENAI_API_ERROR" };
  }
}
