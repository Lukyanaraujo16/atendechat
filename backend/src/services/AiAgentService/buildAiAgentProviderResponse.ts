import AiAgent from "../../models/AiAgent";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { generateChatCompletionViaAdapter } from "../AiProviderService/AiProviderAdapterFactory";
import { buildAiAgentPromptContext } from "./buildAiAgentPromptContext";
import { buildAiAgentSystemPrompt } from "./buildAiAgentSystemPrompt";
import { loadAiAgentProfileForRuntime } from "./resolveAiAgentBusinessPrompt";
import {
  parseAiAgentMaxTokens,
  parseAiAgentModelForProvider
} from "./aiAgentValidation";
import { resolveAiAgentOpenAiApiKeyWithSource } from "./resolveAiAgentApiCredential";
import { AI_AGENT_SHADOW_ERROR_CODES } from "./aiAgentShadowErrors";
import {
  applyKnowledgeToSystemPrompt,
  buildKnowledgeRuntimeMetadata,
  safeRetrieveKnowledgeForAgent
} from "./knowledge/integrateKnowledgeIntoRuntime";
import type { KnowledgeRetrievalResult } from "./knowledge/knowledgeRetrievalTypes";
import { safeEmitKnowledgeObservability } from "./analytics/emitKnowledgeObservability";
import { safeRecordAgentAnalyticsEvent } from "./analytics/recordAgentAnalyticsEvent";
import { enforceAiAgentVisionResponseIntegrity } from "./enforceAiAgentVisionResponseIntegrity";

export type BuildAiAgentProviderResponseInput = {
  companyId: number;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  agent: AiAgent;
  inboundText: string;
  source: string;
  timeoutMs: number;
  maxTokensCap: number;
  logId?: number;
  /** simulator | shadow | live */
  knowledgeChannel?: "shadow" | "live";
  messageId?: string | null;
  /** Partes de imagem do turno atual (visão). */
  imageParts?: Array<{ mimeType: string; base64: string }>;
  /** Query alternativa para Knowledge (ex.: transcrição). */
  knowledgeQuery?: string | null;
};

export type BuildAiAgentProviderResponseSuccess = {
  ok: true;
  text: string;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  contextMessageCount: number;
  contextHash: string;
  credentialSource: string;
  credentialId: number | null;
  knowledge?: KnowledgeRetrievalResult | null;
  knowledgeMeta?: Record<string, unknown> | null;
  forceHandoff?: boolean;
  visionFalseDenialDetected?: boolean;
  visionFalseDenialRetried?: boolean;
  visionFalseDenialFallback?: boolean;
};

export type BuildAiAgentProviderResponseFailure = {
  ok: false;
  errorCode: string;
  provider?: string;
  model?: string;
  latencyMs: number;
  contextMessageCount?: number;
  contextHash?: string;
  credentialSource?: string;
  credentialId?: number | null;
  isRateLimited?: boolean;
  knowledge?: KnowledgeRetrievalResult | null;
  knowledgeMeta?: Record<string, unknown> | null;
};

export type BuildAiAgentProviderResponseResult =
  | BuildAiAgentProviderResponseSuccess
  | BuildAiAgentProviderResponseFailure;

export async function buildAiAgentProviderResponse(
  input: BuildAiAgentProviderResponseInput
): Promise<BuildAiAgentProviderResponseResult> {
  const startedAt = Date.now();

  const resolved = await resolveAiAgentOpenAiApiKeyWithSource({
    companyId: input.companyId,
    whatsapp: input.whatsapp,
    ticket: input.ticket,
    agent: input.agent
  });

  if (!resolved.apiKey || !resolved.provider) {
    return {
      ok: false,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.AI_AUTH_ERROR,
      latencyMs: Date.now() - startedAt,
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null
    };
  }

  let promptContext;
  try {
    promptContext = await buildAiAgentPromptContext({
      companyId: input.companyId,
      ticket: input.ticket,
      contact: input.contact,
      agent: input.agent,
      currentInboundText: input.inboundText
    });
  } catch {
    return {
      ok: false,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.CONTEXT_BUILD_FAILED,
      latencyMs: Date.now() - startedAt,
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null,
      provider: resolved.provider
    };
  }

  const profile = await loadAiAgentProfileForRuntime({
    companyId: input.companyId,
    aiAgentId: input.agent.id
  });
  let systemPrompt = buildAiAgentSystemPrompt(input.agent, profile);

  const knowledgeChannel = input.knowledgeChannel || "live";
  const knowledgeQuery =
    (input.knowledgeQuery && String(input.knowledgeQuery).trim()) ||
    input.inboundText;
  const retrieval = await safeRetrieveKnowledgeForAgent({
    companyId: input.companyId,
    aiAgentId: input.agent.id,
    query: knowledgeQuery,
    channel: knowledgeChannel,
    conversationContext: promptContext.messages,
    ticketId: input.ticket.id,
    messageId: input.messageId || null,
    shadowSuggestionId:
      knowledgeChannel === "shadow" ? input.logId ?? null : null,
    requestId: input.logId
      ? `${knowledgeChannel}-${input.logId}`
      : `ticket-${input.ticket.id}-${Date.now()}`
  });
  const knowledgeApplied = applyKnowledgeToSystemPrompt(
    systemPrompt,
    retrieval
  );
  systemPrompt = knowledgeApplied.systemPrompt;
  const knowledgeMeta = buildKnowledgeRuntimeMetadata(retrieval);

  let model: string;
  let maxTokens: number;
  try {
    model = parseAiAgentModelForProvider(input.agent.model, resolved.provider);
    maxTokens = Math.min(parseAiAgentMaxTokens(input.agent.maxTokens), input.maxTokensCap);
  } catch {
    return {
      ok: false,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.INVALID_MODEL,
      latencyMs: Date.now() - startedAt,
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null,
      provider: resolved.provider
    };
  }

  const result = await generateChatCompletionViaAdapter({
    provider: resolved.provider,
    companyId: input.companyId,
    ticketId: input.ticket.id,
    apiKey: resolved.apiKey,
    model,
    maxTokens,
    temperature: input.agent.temperature,
    systemPrompt,
    messages: promptContext.messages,
    timeoutMs: input.timeoutMs,
    source: input.source,
    imageParts: input.imageParts
  });

  const latencyMs = result.latencyMs ?? Date.now() - startedAt;

  if (result.ok === false) {
    void safeEmitKnowledgeObservability({
      companyId: input.companyId,
      aiAgentId: input.agent.id,
      channel: knowledgeChannel,
      query: input.inboundText,
      retrieval,
      decision: knowledgeApplied.decision,
      ticketId: input.ticket.id,
      runtimeLogId: input.logId ?? null,
      messageId: input.messageId,
      requestId: input.logId
        ? `${knowledgeChannel}-${input.logId}`
        : null,
      provider: resolved.provider,
      model,
      latencyMs,
      systemPrompt,
      historySummary: {
        contextMessageCount: promptContext.contextMessageCount,
        contextHash: promptContext.contextHash
      },
      interaction: true
    });
    return {
      ok: false,
      errorCode: result.errorCode,
      provider: resolved.provider,
      model,
      latencyMs,
      contextMessageCount: promptContext.contextMessageCount,
      contextHash: promptContext.contextHash,
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null,
      isRateLimited:
        result.errorCode === AI_AGENT_SHADOW_ERROR_CODES.AI_USAGE_LIMIT_REACHED,
      knowledge: retrieval,
      knowledgeMeta
    };
  }

  const textRaw = result.text?.trim() || "";
  if (!textRaw) {
    void safeEmitKnowledgeObservability({
      companyId: input.companyId,
      aiAgentId: input.agent.id,
      channel: knowledgeChannel,
      query: input.inboundText,
      retrieval,
      decision: knowledgeApplied.decision,
      ticketId: input.ticket.id,
      runtimeLogId: input.logId ?? null,
      messageId: input.messageId,
      requestId: input.logId
        ? `${knowledgeChannel}-${input.logId}`
        : null,
      provider: result.provider || resolved.provider,
      model: result.model || model,
      latencyMs,
      systemPrompt,
      historySummary: {
        contextMessageCount: promptContext.contextMessageCount,
        contextHash: promptContext.contextHash
      },
      interaction: true
    });
    return {
      ok: false,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE,
      provider: result.provider || resolved.provider,
      model: result.model || model,
      latencyMs,
      contextMessageCount: promptContext.contextMessageCount,
      contextHash: promptContext.contextHash,
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null,
      knowledge: retrieval,
      knowledgeMeta
    };
  }

  const visionGuard = await enforceAiAgentVisionResponseIntegrity({
    hasImageParts: Array.isArray(input.imageParts) && input.imageParts.length > 0,
    text: textRaw,
    provider: resolved.provider,
    companyId: input.companyId,
    ticketId: input.ticket.id,
    apiKey: resolved.apiKey,
    model,
    maxTokens,
    temperature: input.agent.temperature,
    systemPrompt,
    messages: promptContext.messages,
    timeoutMs: input.timeoutMs,
    source: input.source,
    imageParts: input.imageParts
  });
  const text = visionGuard.text;
  const totalLatencyMs = latencyMs + visionGuard.latencyMsExtra;

  void safeEmitKnowledgeObservability({
    companyId: input.companyId,
    aiAgentId: input.agent.id,
    channel: knowledgeChannel,
    query: input.inboundText,
    retrieval,
    decision: knowledgeApplied.decision,
    ticketId: input.ticket.id,
    runtimeLogId: input.logId ?? null,
    messageId: input.messageId,
    requestId: input.logId ? `${knowledgeChannel}-${input.logId}` : null,
    provider: result.provider || resolved.provider,
    model: result.model || model,
    latencyMs: totalLatencyMs,
    responseText: text,
    systemPrompt,
    historySummary: {
      contextMessageCount: promptContext.contextMessageCount,
      contextHash: promptContext.contextHash
    },
    tokensInput: result.promptTokens,
    tokensOutput: result.completionTokens,
    interaction: true
  });

  if (knowledgeChannel === "live") {
    void safeRecordAgentAnalyticsEvent({
      companyId: input.companyId,
      aiAgentId: input.agent.id,
      channel: "live",
      kind: "generation",
      tokensInput: result.promptTokens,
      tokensOutput: result.completionTokens,
      provider: result.provider || resolved.provider,
      model: result.model || model,
      generationTimeMs: totalLatencyMs
    });
  }

  return {
    ok: true,
    text,
    model: result.model || model,
    provider: result.provider || resolved.provider,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    totalTokens: result.totalTokens,
    latencyMs: totalLatencyMs,
    contextMessageCount: promptContext.contextMessageCount,
    contextHash: promptContext.contextHash,
    credentialSource: resolved.source,
    credentialId: resolved.credentialId ?? null,
    knowledge: retrieval,
    knowledgeMeta: {
      ...(knowledgeMeta || {}),
      ...visionGuard.meta
    },
    forceHandoff: knowledgeApplied.forceHandoff,
    visionFalseDenialDetected: visionGuard.meta.visionFalseDenialDetected,
    visionFalseDenialRetried: visionGuard.meta.visionFalseDenialRetried,
    visionFalseDenialFallback: visionGuard.meta.visionFalseDenialFallback
  };
}
