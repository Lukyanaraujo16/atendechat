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
}

export type ExecuteOpenAiResult =
  | { ok: true; content: string; tokensUsed: number }
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
    temperature
  } = params;

  if (!(await canMakeOpenAiCalls(companyId, 1))) {
    logger.warn(
      { companyId, ticketId, limit: OPENAI_DAILY_CALL_LIMIT },
      "[OpenAiManager] OPENAI_LIMIT_REACHED (chat)"
    );
    return { ok: false, error: "OPENAI_LIMIT_REACHED" };
  }

  const finalMessages = buildMessages(prompt, messages);
  const safeModel = resolveOpenAiModel(model);

  logger.info(
    { companyId, ticketId, model: safeModel },
    "[OpenAiManager] chamada OpenAI (chat)"
  );

  try {
    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);

    const chat = await openai.createChatCompletion({
      model: safeModel,
      messages: finalMessages,
      max_tokens: maxTokens,
      temperature
    });

    const content = chat.data.choices[0]?.message?.content ?? "";
    const usage = chat.data.usage;
    const tokensUsed =
      usage?.total_tokens ??
      (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);

    await assertUnderLimitAndLog(companyId, ticketId, tokensUsed);

    return { ok: true, content, tokensUsed };
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
 */
export async function executeOpenAiTranscription(params: {
  companyId: number;
  ticketId?: number | null;
  apiKey: string;
  file: NodeJS.ReadableStream;
}): Promise<ExecuteTranscriptionResult> {
  const { companyId, ticketId, apiKey, file } = params;

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

    const transcription = await openai.createTranscription(file as any, "whisper-1");
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
