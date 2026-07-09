import AiAgent from "../../models/AiAgent";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { debounce } from "../../helpers/Debounce";
import { executeOpenAi } from "../OpenAi/OpenAiManager";
import { logger } from "../../utils/logger";
import { buildAiAgentPromptContext } from "./buildAiAgentPromptContext";
import { buildAiAgentSystemPrompt } from "./buildAiAgentSystemPrompt";
import { parseAiAgentMaxTokens, parseAiAgentModel } from "./aiAgentValidation";
import { resolveAiAgentOpenAiApiKeyWithSource } from "./resolveAiAgentApiCredential";
import {
  AI_AGENT_SHADOW_DEBOUNCE_MS,
  AI_AGENT_SHADOW_MAX_TOKENS_CAP,
  AI_AGENT_SHADOW_SOURCE,
  AI_AGENT_SHADOW_TIMEOUT_MS
} from "./aiAgentShadowConfig";
import {
  AI_AGENT_SHADOW_ERROR_CODES,
  AI_AGENT_SHADOW_STATUSES
} from "./aiAgentShadowErrors";
import {
  claimShadowGeneration,
  markSupersededShadowLogs,
  updateAiAgentShadowLog
} from "./AiAgentShadowLogService";
import { resolveWhatsappAiAgentRuntimeMode } from "./aiAgentRuntimeMode";
import { InboundMessageClassification } from "./classifyInboundMessage";

const inFlightTickets = new Set<number>();

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

async function loadShadowEntities(log: AiAgentRuntimeLog): Promise<{
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  agent: AiAgent;
} | null> {
  const ticket = await Ticket.findOne({
    where: { id: log.ticketId, companyId: log.companyId }
  });
  const contact = log.contactId
    ? await Contact.findOne({
        where: { id: log.contactId, companyId: log.companyId }
      })
    : null;
  const whatsapp = log.whatsappId
    ? await Whatsapp.findOne({
        where: { id: log.whatsappId, companyId: log.companyId }
      })
    : null;
  const agent = log.aiAgentId
    ? await AiAgent.findOne({
        where: { id: log.aiAgentId, companyId: log.companyId }
      })
    : null;

  if (!ticket || !contact || !whatsapp || !agent) {
    return null;
  }
  return { ticket, contact, whatsapp, agent };
}

export async function generateShadowSuggestionForLog(
  logId: number,
  companyId: number,
  inboundText: string,
  classification: InboundMessageClassification
): Promise<void> {
  if (!classification.hasText) {
    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.SKIPPED,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.NOT_ELIGIBLE
    });
    return;
  }

  const log = await AiAgentRuntimeLog.findOne({
    where: { id: logId, companyId }
  });
  if (!log || !log.eligible) {
    return;
  }

  if (log.shadowStatus === AI_AGENT_SHADOW_STATUSES.GENERATED) {
    return;
  }

  const entities = await loadShadowEntities(log);
  if (!entities) {
    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.CONTEXT_BUILD_FAILED
    });
    return;
  }

  const { ticket, contact, whatsapp, agent } = entities;
  const mode = resolveWhatsappAiAgentRuntimeMode(whatsapp);
  if (mode !== "shadow") {
    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.SKIPPED,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.NOT_SHADOW_MODE
    });
    return;
  }

  if (!agent.enabled) {
    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.SKIPPED,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.NOT_ELIGIBLE
    });
    return;
  }

  if (inFlightTickets.has(ticket.id)) {
    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.SKIPPED,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.DEBOUNCED_SUPERSEDED
    });
    return;
  }

  const claimed = await claimShadowGeneration(logId, companyId);
  if (!claimed) {
    return;
  }

  inFlightTickets.add(ticket.id);
  const startedAt = Date.now();

  try {
    const resolved = await resolveAiAgentOpenAiApiKeyWithSource({
      companyId,
      whatsapp,
      ticket,
      agent
    });
    if (!resolved.apiKey) {
      await updateAiAgentShadowLog(logId, companyId, {
        shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
        errorCode: AI_AGENT_SHADOW_ERROR_CODES.AI_AUTH_ERROR,
        latencyMs: Date.now() - startedAt
      });
      return;
    }

    let promptContext;
    try {
      promptContext = await buildAiAgentPromptContext({
        companyId,
        ticket,
        contact,
        agent,
        currentInboundText: inboundText
      });
    } catch {
      await updateAiAgentShadowLog(logId, companyId, {
        shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
        errorCode: AI_AGENT_SHADOW_ERROR_CODES.CONTEXT_BUILD_FAILED,
        latencyMs: Date.now() - startedAt
      });
      return;
    }

    const systemPrompt = buildAiAgentSystemPrompt(agent);
    let model: string;
    let maxTokens: number;
    try {
      model = parseAiAgentModel(agent.model);
      maxTokens = Math.min(
        parseAiAgentMaxTokens(agent.maxTokens),
        AI_AGENT_SHADOW_MAX_TOKENS_CAP
      );
    } catch {
      await updateAiAgentShadowLog(logId, companyId, {
        shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
        errorCode: AI_AGENT_SHADOW_ERROR_CODES.INVALID_MODEL,
        latencyMs: Date.now() - startedAt
      });
      return;
    }

    const result = await withTimeout(
      executeOpenAi({
        companyId,
        ticketId: ticket.id,
        apiKey: resolved.apiKey,
        prompt: systemPrompt,
        messages: promptContext.messages,
        model,
        maxTokens,
        temperature: agent.temperature,
        source: AI_AGENT_SHADOW_SOURCE
      }),
      AI_AGENT_SHADOW_TIMEOUT_MS
    );

    const latencyMs = Date.now() - startedAt;

    if (!result.ok) {
      const isLimit =
        "error" in result && result.error === "OPENAI_LIMIT_REACHED";
      await updateAiAgentShadowLog(logId, companyId, {
        shadowStatus: isLimit
          ? AI_AGENT_SHADOW_STATUSES.RATE_LIMITED
          : AI_AGENT_SHADOW_STATUSES.FAILED,
        errorCode: isLimit
          ? AI_AGENT_SHADOW_ERROR_CODES.AI_USAGE_LIMIT_REACHED
          : AI_AGENT_SHADOW_ERROR_CODES.PROVIDER_UNAVAILABLE,
        shadowModel: model,
        contextMessageCount: promptContext.contextMessageCount,
        contextHash: promptContext.contextHash,
        latencyMs
      });

      if (!isLimit && agent.fallbackMessage?.trim()) {
        await updateAiAgentShadowLog(logId, companyId, {
          suggestedReply: agent.fallbackMessage.trim(),
          suggestionSource: "fallback",
          shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED
        });
      }
      return;
    }

    const content = result.content?.trim();
    if (!content) {
      await updateAiAgentShadowLog(logId, companyId, {
        shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
        errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE,
        shadowModel: model,
        contextMessageCount: promptContext.contextMessageCount,
        contextHash: promptContext.contextHash,
        latencyMs
      });
      return;
    }

    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.GENERATED,
      suggestedReply: content,
      suggestionSource: "model",
      shadowModel: model,
      promptTokens: result.promptTokens ?? null,
      completionTokens: result.completionTokens ?? null,
      totalTokens: result.tokensUsed ?? null,
      contextMessageCount: promptContext.contextMessageCount,
      contextHash: promptContext.contextHash,
      latencyMs,
      generatedAt: new Date(),
      errorCode: null
    });

    logger.info(
      {
        companyId,
        ticketId: ticket.id,
        logId,
        model,
        latencyMs,
        source: AI_AGENT_SHADOW_SOURCE,
        totalTokens: result.tokensUsed ?? null
      },
      "[AiAgent][shadow] suggestion_generated"
    );
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const isTimeout =
      err instanceof Error && err.message === "SHADOW_TIMEOUT";
    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
      errorCode: isTimeout
        ? AI_AGENT_SHADOW_ERROR_CODES.PROVIDER_TIMEOUT
        : AI_AGENT_SHADOW_ERROR_CODES.GENERATION_FAILED,
      latencyMs
    });
    logger.warn(
      { err, companyId, logId, ticketId: log.ticketId },
      "[AiAgent][shadow] generation_failed"
    );
  } finally {
    inFlightTickets.delete(log.ticketId ?? 0);
  }
}

const debouncedShadowByTicket = new Map<
  number,
  { fn: ReturnType<typeof debounce>; ticketId: number }
>();

const pendingShadowByTicket = new Map<
  number,
  {
    logId: number;
    companyId: number;
    ticketId: number;
    inboundText: string;
    classification: InboundMessageClassification;
  }
>();

function ensureDebouncedShadowRunner(ticketId: number): () => void {
  const existing = debouncedShadowByTicket.get(ticketId);
  if (existing) return existing.fn;

  const fn = debounce(async () => {
    const pending = pendingShadowByTicket.get(ticketId);
    if (!pending) return;
    pendingShadowByTicket.delete(ticketId);
    await markSupersededShadowLogs(
      pending.ticketId,
      pending.companyId,
      pending.logId
    );
    await generateShadowSuggestionForLog(
      pending.logId,
      pending.companyId,
      pending.inboundText,
      pending.classification
    );
  }, AI_AGENT_SHADOW_DEBOUNCE_MS, ticketId);

  debouncedShadowByTicket.set(ticketId, { fn, ticketId });
  return fn;
}

export function scheduleShadowGeneration(input: {
  logId: number;
  companyId: number;
  ticketId: number;
  inboundText: string;
  classification: InboundMessageClassification;
}): void {
  pendingShadowByTicket.set(input.ticketId, input);
  ensureDebouncedShadowRunner(input.ticketId)();
}
