import { logger } from "../../../utils/logger";
import AiAgent from "../../../models/AiAgent";
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import { buildAiAgentProviderResponse } from "../../AiAgentService/buildAiAgentProviderResponse";
import { buildAiAgentPromptContext } from "../../AiAgentService/buildAiAgentPromptContext";
import { buildAiAgentSystemPrompt } from "../../AiAgentService/buildAiAgentSystemPrompt";
import { loadAiAgentProfileForRuntime } from "../../AiAgentService/resolveAiAgentBusinessPrompt";
import {
  parseAiAgentMaxTokens,
  parseAiAgentModelForProvider
} from "../../AiAgentService/aiAgentValidation";
import { resolveAiAgentOpenAiApiKeyWithSource } from "../../AiAgentService/resolveAiAgentApiCredential";
import {
  applyKnowledgeToSystemPrompt,
  buildKnowledgeRuntimeMetadata,
  safeRetrieveKnowledgeForAgent
} from "../../AiAgentService/knowledge/integrateKnowledgeIntoRuntime";
import {
  AI_AGENT_LIVE_MAX_TOKENS_CAP,
  AI_AGENT_LIVE_SOURCE,
  AI_AGENT_LIVE_TIMEOUT_MS
} from "../../AiAgentService/aiAgentLiveConfig";
import { runFunctionCallingLoop } from "../tools/functionCalling/AutomationToolCallLoop";
import { evaluateLiveEligibility } from "./AutomationEligibilityEngine";
import {
  recordLiveEligibility,
  recordLiveFcExecution
} from "./LiveRolloutMetrics";
import { loadLiveRolloutConfig } from "./LiveRolloutConfigService";
import { estimateCostUsd } from "../../AiAgentService/shadowFc/shadowFcComparison";
import { buildEvidenceReport } from "../evidence/AutomationEvidenceEngine";
import { recordEvidenceReport } from "../evidence/EvidenceMetrics";
import { AUTOMATION_LIVE_ROLLOUT_VERSION } from "../../../config/automationLiveRolloutConstants";
import { buildExecutionPolicySnapshot } from "./hardening/ExecutionPolicySnapshot";
import {
  recordDistributedMetric,
  recordDistributedLatency
} from "./hardening/DistributedMetricsStore";
import {
  isCircuitBlocking,
  recordCircuitFailure,
  recordCircuitSuccess
} from "./hardening/DistributedCircuitBreaker";
import { assertLiveRateLimits } from "./hardening/DistributedRateLimiter";
import { pushSample } from "./hardening/SampleWindowEngine";
import { recordFailureAggregate } from "./hardening/FailureAggregator";
import { evaluateProductionAlerts } from "./hardening/ProductionAlerts";
import { createHash } from "crypto";

export type LiveFcGenerationResult = {
  ok: boolean;
  text?: string;
  usedFunctionCalling: boolean;
  fallback: boolean;
  fallbackReason?: string;
  eligibility?: Awaited<ReturnType<typeof evaluateLiveEligibility>>;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  contextMessageCount?: number;
  contextHash?: string;
  credentialSource?: string;
  credentialId?: number | null;
  knowledgeMeta?: Record<string, unknown> | null;
  forceHandoff?: boolean;
  errorCode?: string;
  isRateLimited?: boolean;
  liveFcMeta?: Record<string, unknown>;
};

/**
 * Tenta Live FC; se inelegível ou falha → fallback legado (buildAiAgentProviderResponse).
 * Write Tools permanecem OFF salvo allowWriteToolsLive explícito (e mesmo assim Selection usa read_only).
 */
export async function generateLiveResponseWithOptionalFc(input: {
  companyId: number;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  agent: AiAgent;
  inboundText: string;
  logId?: number;
  messageId?: string | null;
  messageHints?: {
    fromMe?: boolean;
    mediaType?: string | null;
    ticketStatus?: string | null;
    userId?: number | null;
    isFirstInbound?: boolean;
  } | null;
}): Promise<LiveFcGenerationResult> {
  const started = Date.now();
  const executionId = createHash("sha256")
    .update(
      `${input.companyId}:${input.ticket.id}:${input.logId || ""}:${input.messageId || ""}:${started}`
    )
    .digest("hex")
    .slice(0, 24);

  // Config lida UMA vez — congelada no snapshot
  const config = await loadLiveRolloutConfig(input.companyId);

  const resolved = await resolveAiAgentOpenAiApiKeyWithSource({
    companyId: input.companyId,
    whatsapp: input.whatsapp,
    ticket: input.ticket,
    agent: input.agent
  });

  const eligibility = await evaluateLiveEligibility({
    companyId: input.companyId,
    whatsappId: input.whatsapp.id,
    aiAgentId: input.agent.id,
    ticketId: input.ticket.id,
    messageId: input.messageId,
    provider: resolved.provider || null,
    message: {
      fromMe: input.messageHints?.fromMe === true,
      mediaType: input.messageHints?.mediaType || "chat",
      body: input.inboundText,
      ticketStatus: input.messageHints?.ticketStatus || input.ticket.status,
      userId: input.messageHints?.userId ?? input.ticket.userId ?? null,
      isFirstInbound: input.messageHints?.isFirstInbound
    }
  });

  const policySnapshot = buildExecutionPolicySnapshot({
    executionId,
    companyId: input.companyId,
    ticketId: input.ticket.id,
    connectionId: input.whatsapp.id,
    agentId: input.agent.id,
    messageId: input.messageId,
    provider: resolved.provider || null,
    eligibility,
    config,
    featureFlags: {
      liveFc: true,
      writeTools: false
    },
    availableTools: []
  });

  recordLiveEligibility({
    companyId: input.companyId,
    eligible: eligibility.eligible,
    canaryIn: eligibility.gates.canary,
    stage: eligibility.stage
  });
  void recordDistributedMetric({
    companyId: input.companyId,
    field: eligibility.eligible ? "eligible" : "ineligible"
  });

  // Hardening gates (além da eligibility) — usam snapshot, não re-lêem config
  if (eligibility.eligible && resolved.apiKey && resolved.provider) {
    const circuitOpen = await isCircuitBlocking({
      scope: "company",
      id: String(input.companyId)
    });
    const providerCircuit = await isCircuitBlocking({
      scope: "provider",
      id: String(resolved.provider)
    });
    if (circuitOpen || providerCircuit) {
      eligibility.eligible = false;
      eligibility.blockers.push(
        circuitOpen ? "circuit_company_open" : "circuit_provider_open"
      );
      void recordDistributedMetric({
        companyId: input.companyId,
        field: "circuitOpens"
      });
    } else {
      const rl = await assertLiveRateLimits({
        companyId: input.companyId,
        connectionId: input.whatsapp.id,
        agentId: input.agent.id,
        provider: resolved.provider
      });
      if (!rl.allowed) {
        eligibility.eligible = false;
        eligibility.blockers.push(`rate_limit:${rl.blockedBy}`);
      }
    }
  }

  if (!eligibility.eligible || !resolved.apiKey || !resolved.provider) {
    const legacy = await buildAiAgentProviderResponse({
      companyId: input.companyId,
      ticket: input.ticket,
      contact: input.contact,
      whatsapp: input.whatsapp,
      agent: input.agent,
      inboundText: input.inboundText,
      source: AI_AGENT_LIVE_SOURCE,
      timeoutMs: AI_AGENT_LIVE_TIMEOUT_MS,
      maxTokensCap: AI_AGENT_LIVE_MAX_TOKENS_CAP,
      logId: input.logId,
      knowledgeChannel: "live",
      messageId: input.messageId
    });
    if (legacy.ok === false) {
      return {
        ok: false,
        usedFunctionCalling: false,
        fallback: true,
        fallbackReason: eligibility.eligible
          ? "credential_or_legacy_failed"
          : `ineligible:${eligibility.blockers.join(",")}`,
        eligibility,
        latencyMs: legacy.latencyMs,
        errorCode: legacy.errorCode,
        isRateLimited: legacy.isRateLimited,
        credentialSource: legacy.credentialSource,
        credentialId: legacy.credentialId,
        knowledgeMeta: legacy.knowledgeMeta,
        liveFcMeta: {
          version: AUTOMATION_LIVE_ROLLOUT_VERSION,
          usedFunctionCalling: false,
          eligibility,
          policySnapshot
        }
      };
    }
    return {
      ok: true,
      text: legacy.text,
      usedFunctionCalling: false,
      fallback: true,
      fallbackReason: eligibility.eligible
        ? "missing_credential"
        : `ineligible:${eligibility.blockers.join(",")}`,
      eligibility,
      model: legacy.model,
      provider: legacy.provider,
      promptTokens: legacy.promptTokens,
      completionTokens: legacy.completionTokens,
      totalTokens: legacy.totalTokens,
      latencyMs: legacy.latencyMs,
      contextMessageCount: legacy.contextMessageCount,
      contextHash: legacy.contextHash,
      credentialSource: legacy.credentialSource,
      credentialId: legacy.credentialId,
      knowledgeMeta: legacy.knowledgeMeta,
      forceHandoff: legacy.forceHandoff,
      liveFcMeta: {
        version: AUTOMATION_LIVE_ROLLOUT_VERSION,
        usedFunctionCalling: false,
        eligibility,
        policySnapshot
      }
    };
  }

  try {
    const profile = await loadAiAgentProfileForRuntime({
      companyId: input.companyId,
      aiAgentId: input.agent.id
    });
    let systemPrompt = buildAiAgentSystemPrompt(input.agent, profile);
    const promptContext = await buildAiAgentPromptContext({
      companyId: input.companyId,
      ticket: input.ticket,
      contact: input.contact,
      agent: input.agent,
      currentInboundText: input.inboundText
    });
    const retrieval = await safeRetrieveKnowledgeForAgent({
      companyId: input.companyId,
      aiAgentId: input.agent.id,
      query: input.inboundText,
      channel: "live",
      conversationContext: promptContext.messages,
      ticketId: input.ticket.id,
      messageId: input.messageId || null,
      requestId: input.logId
        ? `live-fc-${input.logId}`
        : `live-fc-${input.ticket.id}`
    });
    const knowledgeApplied = applyKnowledgeToSystemPrompt(
      systemPrompt,
      retrieval
    );
    systemPrompt = knowledgeApplied.systemPrompt;
    const knowledgeMeta = buildKnowledgeRuntimeMetadata(retrieval);

    const model = parseAiAgentModelForProvider(
      input.agent.model,
      resolved.provider
    );
    const maxTokens = Math.min(
      parseAiAgentMaxTokens(input.agent.maxTokens),
      AI_AGENT_LIVE_MAX_TOKENS_CAP
    );

    // Snapshot garante Write Tools OFF — nunca relê config
    const allowWrite = false;

    const trace = await runFunctionCallingLoop({
      companyId: input.companyId,
      aiAgentId: input.agent.id,
      ticketId: input.ticket.id,
      contactId: input.contact.id,
      provider: resolved.provider!,
      apiKey: resolved.apiKey!,
      model,
      temperature: input.agent.temperature,
      maxTokens,
      systemPrompt,
      messages: promptContext.messages,
      timeoutMs: AI_AGENT_LIVE_TIMEOUT_MS,
      source: "ai_agent_live_fc",
      origin: "live",
      allowWriteTools: allowWrite
    });

    const text = (trace.finalText || "").trim();
    if (!text) {
      throw new Error("empty_fc_response");
    }

    const promptTokens = trace.iterations.reduce(
      (n, i) => n + (i.promptTokens || 0),
      0
    );
    const completionTokens = trace.iterations.reduce(
      (n, i) => n + (i.completionTokens || 0),
      0
    );
    const totalTokens = promptTokens + completionTokens;
    const latencyMs = Date.now() - started;
    const resolutions = trace.iterations.flatMap(it => it.resolutions || []);
    const toolFailures = resolutions.filter(
      r => r.status === "failure" || r.status === "invalid"
    ).length;

    recordLiveFcExecution({
      companyId: input.companyId,
      provider: resolved.provider,
      stage: eligibility.stage,
      toolCallCount: resolutions.length,
      toolFailures,
      latencyMs,
      tokens: totalTokens,
      costUsd: estimateCostUsd(totalTokens),
      fallback: false,
      timeout: Boolean(trace.loopStopReason?.includes("timeout"))
    });

    void recordDistributedMetric({
      companyId: input.companyId,
      field: "liveExecutions"
    });
    void recordDistributedMetric({
      companyId: input.companyId,
      field: "tokens",
      n: totalTokens
    });
    if (toolFailures) {
      void recordDistributedMetric({
        companyId: input.companyId,
        field: "toolFailures",
        n: toolFailures
      });
      void recordFailureAggregate({
        companyId: input.companyId,
        dimension: "company",
        id: input.companyId,
        kind: "tool_failure"
      });
    }
    void recordDistributedLatency(input.companyId, latencyMs);
    void pushSample({ companyId: input.companyId, metric: "latency", value: latencyMs });
    void recordCircuitSuccess({
      scope: "company",
      id: String(input.companyId)
    });
    if (resolved.provider) {
      void recordCircuitSuccess({
        scope: "provider",
        id: String(resolved.provider)
      });
    }
    void evaluateProductionAlerts(input.companyId);

    // Live Evidence (source=live) — métricas separadas via primaryType + metadata
    try {
      const report = buildEvidenceReport({
        id: input.logId || input.ticket.id,
        companyId: input.companyId,
        aiAgentId: input.agent.id,
        whatsappId: input.whatsapp.id,
        provider: resolved.provider,
        model,
        shadowReply: text,
        usedTools: resolutions.length > 0,
        usedKnowledge: Boolean((knowledgeMeta as any)?.knowledge?.used),
        toolCallCount: resolutions.length,
        loopStopReason: trace.loopStopReason,
        latencyMs,
        totalTokens,
        estimatedCostUsd: estimateCostUsd(totalTokens),
        knowledgeMeta,
        trace: {
          iterations: trace.iterations.map(it => ({
            index: it.index,
            resolutions: it.resolutions
          }))
        },
        metadata: { source: "live", stage: eligibility.stage }
      });
      recordEvidenceReport({
        companyId: input.companyId,
        aiAgentId: input.agent.id,
        whatsappId: input.whatsapp.id,
        provider: resolved.provider,
        primaryType: report.primaryType,
        verified: report.scores.verified,
        hallucination: report.scores.hallucination,
        knowledgeVerified: report.scores.knowledgeVerified,
        knowledgeUnused: report.scores.knowledgeUnused,
        emptyResult: report.scores.emptyResult,
        toolUnused: report.scores.toolUnused,
        toolCallCount: resolutions.length,
        latencyMs,
        tokens: totalTokens,
        costUsd: estimateCostUsd(totalTokens),
        loopStopped: Boolean(trace.loopStopReason),
        toolIds: report.summary.toolIds,
        findings: report.findings
      });
    } catch (evErr) {
      logger.warn({ evErr }, "[LiveFC] evidence_record_failed");
    }

    return {
      ok: true,
      text,
      usedFunctionCalling: true,
      fallback: false,
      eligibility,
      model,
      provider: resolved.provider,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      contextMessageCount: promptContext.messages.length,
      contextHash: promptContext.contextHash,
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null,
      knowledgeMeta,
      liveFcMeta: {
        version: AUTOMATION_LIVE_ROLLOUT_VERSION,
        usedFunctionCalling: true,
        stage: policySnapshot.stage,
        canaryBucket: policySnapshot.canaryBucket,
        effectivePercent: policySnapshot.effectivePercent,
        allowWriteToolsLive: false,
        loopStopReason: trace.loopStopReason || null,
        toolCallCount: resolutions.length,
        selectedTools: trace.selectedTools,
        eligibility,
        policySnapshot
      }
    };
  } catch (err) {
    logger.warn(
      { err, ticketId: input.ticket.id, companyId: input.companyId },
      "[LiveFC] fallback_to_legacy"
    );
    recordLiveFcExecution({
      companyId: input.companyId,
      provider: resolved.provider,
      stage: eligibility.stage,
      fallback: true,
      timeout: /timeout/i.test(err instanceof Error ? err.message : "")
    });
    void recordDistributedMetric({
      companyId: input.companyId,
      field: "fallbacks"
    });
    if (/timeout/i.test(err instanceof Error ? err.message : "")) {
      void recordDistributedMetric({
        companyId: input.companyId,
        field: "timeouts"
      });
    }
    void recordCircuitFailure({
      scope: "company",
      id: String(input.companyId)
    });
    if (resolved.provider) {
      void recordCircuitFailure({
        scope: "provider",
        id: String(resolved.provider)
      });
      void recordDistributedMetric({
        companyId: input.companyId,
        field: "providerFailures"
      });
      void recordFailureAggregate({
        companyId: input.companyId,
        dimension: "provider",
        id: String(resolved.provider),
        kind: "fc_failure"
      });
    }
    void pushSample({ companyId: input.companyId, metric: "fallback", value: 1 });
    void evaluateProductionAlerts(input.companyId);

    const legacy = await buildAiAgentProviderResponse({
      companyId: input.companyId,
      ticket: input.ticket,
      contact: input.contact,
      whatsapp: input.whatsapp,
      agent: input.agent,
      inboundText: input.inboundText,
      source: AI_AGENT_LIVE_SOURCE,
      timeoutMs: AI_AGENT_LIVE_TIMEOUT_MS,
      maxTokensCap: AI_AGENT_LIVE_MAX_TOKENS_CAP,
      logId: input.logId,
      knowledgeChannel: "live",
      messageId: input.messageId
    });

    if (legacy.ok === false) {
      return {
        ok: false,
        usedFunctionCalling: false,
        fallback: true,
        fallbackReason: err instanceof Error ? err.message : "fc_failed",
        eligibility,
        latencyMs: legacy.latencyMs,
        errorCode: legacy.errorCode,
        isRateLimited: legacy.isRateLimited,
        liveFcMeta: {
          version: AUTOMATION_LIVE_ROLLOUT_VERSION,
          usedFunctionCalling: false,
          fallback: true,
          eligibility,
          policySnapshot
        }
      };
    }

    return {
      ok: true,
      text: legacy.text,
      usedFunctionCalling: false,
      fallback: true,
      fallbackReason: err instanceof Error ? err.message : "fc_failed",
      eligibility,
      model: legacy.model,
      provider: legacy.provider,
      promptTokens: legacy.promptTokens,
      completionTokens: legacy.completionTokens,
      totalTokens: legacy.totalTokens,
      latencyMs: legacy.latencyMs,
      contextMessageCount: legacy.contextMessageCount,
      contextHash: legacy.contextHash,
      credentialSource: legacy.credentialSource,
      credentialId: legacy.credentialId,
      knowledgeMeta: legacy.knowledgeMeta,
      forceHandoff: legacy.forceHandoff,
      liveFcMeta: {
        version: AUTOMATION_LIVE_ROLLOUT_VERSION,
        usedFunctionCalling: false,
        fallback: true,
        fallbackReason: err instanceof Error ? err.message : "fc_failed",
        eligibility,
        policySnapshot
      }
    };
  }
}

export default { generateLiveResponseWithOptionalFc };
