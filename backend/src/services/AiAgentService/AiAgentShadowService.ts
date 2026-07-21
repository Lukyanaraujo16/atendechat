import AiAgent from "../../models/AiAgent";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { debounce } from "../../helpers/Debounce";
import { logger } from "../../utils/logger";
import { generateChatCompletionViaAdapter } from "../AiProviderService/AiProviderAdapterFactory";
import { buildAiAgentPromptContext } from "./buildAiAgentPromptContext";
import { buildAiAgentSystemPrompt } from "./buildAiAgentSystemPrompt";
import { loadAiAgentProfileForRuntime } from "./resolveAiAgentBusinessPrompt";
import {
  parseAiAgentMaxTokens,
  parseAiAgentModelForProvider
} from "./aiAgentValidation";
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
  mergeAiAgentShadowLogMetadata,
  updateAiAgentShadowLog
} from "./AiAgentShadowLogService";
import { resolveWhatsappAiAgentRuntimeMode } from "./aiAgentRuntimeMode";
import { InboundMessageClassification } from "./classifyInboundMessage";
import {
  applyKnowledgeToSystemPrompt,
  buildKnowledgeRuntimeMetadata,
  safeRetrieveKnowledgeForAgent
} from "./knowledge/integrateKnowledgeIntoRuntime";
import { safeEmitKnowledgeObservability } from "./analytics/emitKnowledgeObservability";
import { safeRecordAgentAnalyticsEvent } from "./analytics/recordAgentAnalyticsEvent";
import {
  acquireAiAgentGenerationLock,
  releaseAiAgentGenerationLock
} from "./knowledge/aiAgentGenerationLock";

const inFlightTickets = new Set<number>();

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

  const lock = await acquireAiAgentGenerationLock({
    channel: "shadow",
    companyId,
    logId
  });
  if (!lock.acquired) {
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

    await mergeAiAgentShadowLogMetadata(logId, companyId, {
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null
    });

    if (!resolved.apiKey || !resolved.provider) {
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

    const profile = await loadAiAgentProfileForRuntime({
      companyId,
      aiAgentId: agent.id
    });
    let systemPrompt = buildAiAgentSystemPrompt(agent, profile);

    const retrieval = await safeRetrieveKnowledgeForAgent({
      companyId,
      aiAgentId: agent.id,
      query: inboundText,
      channel: "shadow",
      conversationContext: promptContext.messages,
      ticketId: ticket.id,
      messageId: log.messageId || null,
      shadowSuggestionId: logId,
      requestId: `shadow-${logId}`
    });
    const knowledgeApplied = applyKnowledgeToSystemPrompt(
      systemPrompt,
      retrieval
    );
    systemPrompt = knowledgeApplied.systemPrompt;
    const knowledgeMeta = buildKnowledgeRuntimeMetadata(retrieval);
    if (knowledgeMeta) {
      await mergeAiAgentShadowLogMetadata(logId, companyId, knowledgeMeta);
    }

    let model: string;
    let maxTokens: number;
    try {
      model = parseAiAgentModelForProvider(agent.model, resolved.provider);
      maxTokens = Math.min(
        parseAiAgentMaxTokens(agent.maxTokens),
        AI_AGENT_SHADOW_MAX_TOKENS_CAP
      );
    } catch {
      await updateAiAgentShadowLog(logId, companyId, {
        shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
        errorCode: AI_AGENT_SHADOW_ERROR_CODES.INVALID_MODEL,
        shadowProvider: resolved.provider,
        latencyMs: Date.now() - startedAt
      });
      return;
    }

    const result = await generateChatCompletionViaAdapter({
      provider: resolved.provider,
      companyId,
      ticketId: ticket.id,
      apiKey: resolved.apiKey,
      model,
      maxTokens,
      temperature: agent.temperature,
      systemPrompt,
      messages: promptContext.messages,
      timeoutMs: AI_AGENT_SHADOW_TIMEOUT_MS,
      source: AI_AGENT_SHADOW_SOURCE
    });

    const latencyMs = result.latencyMs ?? Date.now() - startedAt;

    if (result.ok === false) {
      const isLimit =
        result.errorCode === AI_AGENT_SHADOW_ERROR_CODES.AI_USAGE_LIMIT_REACHED;
      await updateAiAgentShadowLog(logId, companyId, {
        shadowStatus: isLimit
          ? AI_AGENT_SHADOW_STATUSES.RATE_LIMITED
          : AI_AGENT_SHADOW_STATUSES.FAILED,
        errorCode: result.errorCode,
        shadowModel: model,
        shadowProvider: resolved.provider,
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
      void safeEmitKnowledgeObservability({
        companyId,
        aiAgentId: agent.id,
        channel: "shadow",
        query: inboundText,
        retrieval,
        decision: knowledgeApplied.decision,
        ticketId: ticket.id,
        runtimeLogId: logId,
        messageId: log.messageId || null,
        requestId: `shadow-${logId}`,
        provider: resolved.provider,
        model,
        latencyMs,
        systemPrompt,
        interaction: true
      });
      return;
    }

    const content = result.text?.trim();
    if (!content) {
      await updateAiAgentShadowLog(logId, companyId, {
        shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
        errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE,
        shadowModel: model,
        shadowProvider: resolved.provider,
        contextMessageCount: promptContext.contextMessageCount,
        contextHash: promptContext.contextHash,
        latencyMs
      });
      void safeEmitKnowledgeObservability({
        companyId,
        aiAgentId: agent.id,
        channel: "shadow",
        query: inboundText,
        retrieval,
        decision: knowledgeApplied.decision,
        ticketId: ticket.id,
        runtimeLogId: logId,
        messageId: log.messageId || null,
        requestId: `shadow-${logId}`,
        provider: resolved.provider,
        model,
        latencyMs,
        systemPrompt,
        interaction: true
      });
      return;
    }

    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.GENERATED,
      suggestedReply: content,
      suggestionSource: "model",
      shadowModel: result.model || model,
      shadowProvider: result.provider,
      promptTokens: result.promptTokens ?? null,
      completionTokens: result.completionTokens ?? null,
      totalTokens: result.totalTokens ?? null,
      contextMessageCount: promptContext.contextMessageCount,
      contextHash: promptContext.contextHash,
      latencyMs,
      generatedAt: new Date(),
      errorCode: null
    });

    void safeEmitKnowledgeObservability({
      companyId,
      aiAgentId: agent.id,
      channel: "shadow",
      query: inboundText,
      retrieval,
      decision: knowledgeApplied.decision,
      ticketId: ticket.id,
      runtimeLogId: logId,
      messageId: log.messageId || null,
      requestId: `shadow-${logId}`,
      provider: result.provider || resolved.provider,
      model: result.model || model,
      latencyMs,
      responseText: content,
      systemPrompt,
      tokensInput: result.promptTokens,
      tokensOutput: result.completionTokens,
      interaction: true
    });
    void safeRecordAgentAnalyticsEvent({
      companyId,
      aiAgentId: agent.id,
      channel: "shadow",
      kind: "generation",
      tokensInput: result.promptTokens,
      tokensOutput: result.completionTokens,
      provider: result.provider || resolved.provider,
      model: result.model || model,
      generationTimeMs: latencyMs
    });

    // 2.1E — Shadow Function Calling evaluation (observacional, async)
    void (async () => {
      try {
        const { scheduleShadowFcEvaluation } = await import(
          "./shadowFc/ShadowFcEvaluationService"
        );
        await scheduleShadowFcEvaluation({
          companyId,
          runtimeLogId: logId,
          aiAgentId: agent.id,
          whatsappId: whatsapp.id,
          ticketId: ticket.id,
          contactId: contact.id,
          messageId: log.messageId || null,
          officialReply: content,
          officialLatencyMs: latencyMs,
          officialTokens: result.totalTokens ?? null,
          provider: resolved.provider!,
          apiKey: resolved.apiKey!,
          model: result.model || model,
          temperature: agent.temperature,
          maxTokens,
          systemPrompt,
          messages: promptContext.messages,
          knowledgeMeta: knowledgeMeta || null,
          usedKnowledgeOfficial: Boolean(
            (knowledgeMeta as any)?.knowledge?.used === true
          )
        });
      } catch (fcErr) {
        logger.warn(
          { fcErr, logId, companyId },
          "[AiAgent][shadow] fc_schedule_failed"
        );
      }
    })();

    logger.info(
      {
        companyId,
        ticketId: ticket.id,
        logId,
        model: result.model || model,
        provider: result.provider,
        latencyMs,
        source: AI_AGENT_SHADOW_SOURCE,
        totalTokens: result.totalTokens ?? null
      },
      "[AiAgent][shadow] suggestion_generated"
    );
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    await updateAiAgentShadowLog(logId, companyId, {
      shadowStatus: AI_AGENT_SHADOW_STATUSES.FAILED,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.GENERATION_FAILED,
      latencyMs
    });
    logger.warn(
      { err, companyId, logId, ticketId: log.ticketId },
      "[AiAgent][shadow] generation_failed"
    );
  } finally {
    inFlightTickets.delete(log.ticketId ?? 0);
    await releaseAiAgentGenerationLock(lock.key);
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
