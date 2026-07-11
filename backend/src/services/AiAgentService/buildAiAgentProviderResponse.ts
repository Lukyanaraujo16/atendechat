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
  const systemPrompt = buildAiAgentSystemPrompt(input.agent, profile);
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
    source: input.source
  });

  const latencyMs = result.latencyMs ?? Date.now() - startedAt;

  if (result.ok === false) {
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
        result.errorCode === AI_AGENT_SHADOW_ERROR_CODES.AI_USAGE_LIMIT_REACHED
    };
  }

  const text = result.text?.trim() || "";
  if (!text) {
    return {
      ok: false,
      errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE,
      provider: result.provider || resolved.provider,
      model: result.model || model,
      latencyMs,
      contextMessageCount: promptContext.contextMessageCount,
      contextHash: promptContext.contextHash,
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null
    };
  }

  return {
    ok: true,
    text,
    model: result.model || model,
    provider: result.provider || resolved.provider,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    totalTokens: result.totalTokens,
    latencyMs,
    contextMessageCount: promptContext.contextMessageCount,
    contextHash: promptContext.contextHash,
    credentialSource: resolved.source,
    credentialId: resolved.credentialId ?? null
  };
}
