import { logger } from "../../../utils/logger";
import AiAgentShadowEvaluation from "../../../models/AiAgentShadowEvaluation";
import AiAgentRuntimeLog from "../../../models/AiAgentRuntimeLog";
import { runFunctionCallingLoop } from "../../AutomationOrchestrator/tools/functionCalling/AutomationToolCallLoop";
import { isShadowFunctionCallingEnabled } from "./isShadowFunctionCallingEnabled";
import {
  buildObjectiveComparison,
  estimateCostUsd
} from "./shadowFcComparison";
import { recordShadowFcExecution } from "./ShadowFcMetrics";
import { AUTOMATION_SHADOW_FC_VERSION } from "../../../config/automationShadowFcConstants";
import { AI_AGENT_SHADOW_TIMEOUT_MS } from "../aiAgentShadowConfig";
import { AiProviderId } from "../../../config/aiProviderModels";

export type ScheduleShadowFcEvaluationInput = {
  companyId: number;
  runtimeLogId: number;
  aiAgentId: number;
  whatsappId: number;
  ticketId: number;
  contactId: number;
  messageId?: string | null;
  officialReply: string;
  officialLatencyMs?: number | null;
  officialTokens?: number | null;
  provider: AiProviderId;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  messages: import("openai").ChatCompletionRequestMessage[];
  knowledgeMeta?: Record<string, unknown> | null;
  usedKnowledgeOfficial?: boolean;
};

/**
 * Pipeline observacional: baseline (official shadow) × FC shadow.
 * Nunca envia mensagem. Nunca Write Tools / Operation Runtime.
 */
export async function scheduleShadowFcEvaluation(
  input: ScheduleShadowFcEvaluationInput
): Promise<void> {
  void runShadowFcEvaluation(input).catch(err => {
    logger.warn(
      { err, runtimeLogId: input.runtimeLogId, companyId: input.companyId },
      "[AiAgent][shadow-fc] evaluation_failed_unhandled"
    );
  });
}

export async function runShadowFcEvaluation(
  input: ScheduleShadowFcEvaluationInput
): Promise<AiAgentShadowEvaluation | null> {
  const gate = await isShadowFunctionCallingEnabled({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    whatsappId: input.whatsappId
  });

  if (!gate.enabled) {
    logger.debug(
      { companyId: input.companyId, reason: gate.reason, gates: gate.gates },
      "[AiAgent][shadow-fc] skipped_gate"
    );
    return null;
  }

  const log = await AiAgentRuntimeLog.findOne({
    where: { id: input.runtimeLogId, companyId: input.companyId }
  });
  if (!log) return null;

  const evaluation = await AiAgentShadowEvaluation.create({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    ticketId: input.ticketId,
    whatsappId: input.whatsappId,
    runtimeLogId: input.runtimeLogId,
    messageId: input.messageId || null,
    contactId: input.contactId,
    status: "running",
    provider: input.provider,
    model: input.model,
    officialReply: input.officialReply,
    systemPrompt: input.systemPrompt?.slice(0, 20000) || null,
    knowledgeMeta: input.knowledgeMeta || null,
    metadata: {
      version: AUTOMATION_SHADOW_FC_VERSION,
      gates: gate.gates,
      observational: true,
      noMessageSend: true,
      noWriteTools: true
    }
  });

  try {
    const started = Date.now();
    const trace = await runFunctionCallingLoop({
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      ticketId: input.ticketId,
      contactId: input.contactId,
      provider: input.provider,
      apiKey: input.apiKey,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      timeoutMs: AI_AGENT_SHADOW_TIMEOUT_MS,
      source: "ai_agent_shadow_fc",
      origin: "shadow"
    });

    const resolutions = trace.iterations.flatMap(it => it.resolutions || []);
    const toolCallCount = resolutions.length;
    const usedTools = toolCallCount > 0;
    const promptTokens = trace.iterations.reduce(
      (n, i) => n + (i.promptTokens || 0),
      0
    );
    const completionTokens = trace.iterations.reduce(
      (n, i) => n + (i.completionTokens || 0),
      0
    );
    const totalTokens = promptTokens + completionTokens;
    const estimatedCostUsd = estimateCostUsd(totalTokens);
    const latencyMs = Date.now() - started;

    const usedKnowledgeShadow =
      Boolean(
        (input.knowledgeMeta as any)?.knowledge?.used === true ||
          (input.knowledgeMeta as any)?.knowledge?.chunks?.length
      );

    const comparison = buildObjectiveComparison({
      officialReply: input.officialReply,
      shadowReply: trace.finalText || "",
      officialLatencyMs: input.officialLatencyMs,
      shadowLatencyMs: latencyMs,
      officialTokens: input.officialTokens,
      shadowTokens: totalTokens,
      usedTools,
      usedKnowledgeOfficial: input.usedKnowledgeOfficial,
      usedKnowledgeShadow,
      toolCallCount
    });

    const toolAnalytics = {
      selected: trace.selectedTools,
      allowlistSize: trace.allowlist.length,
      calls: resolutions.map(r => ({
        toolId: r.toolId,
        status: r.status,
        durationMs: r.durationMs,
        empty:
          r.modelResult &&
          ((r.modelResult as any).data?.found === false ||
            (Array.isArray((r.modelResult as any).data?.items) &&
              (r.modelResult as any).data.items.length === 0))
      })),
      denials: resolutions.filter(r => r.status === "denied").length,
      failures: resolutions.filter(
        r => r.status === "failure" || r.status === "invalid"
      ).length
    };

    // Sanitizar trace: sem companyId/audit internos
    const safeTrace = {
      version: trace.version,
      provider: trace.provider,
      selectedTools: trace.selectedTools,
      allowlist: trace.allowlist,
      providerPayload: {
        openaiCount: Array.isArray(
          (trace.providerPayload as any)?.openaiTools
        )
          ? (trace.providerPayload as any).openaiTools.length
          : 0,
        geminiCount: Array.isArray(
          (trace.providerPayload as any)?.geminiFunctionDeclarations
        )
          ? (trace.providerPayload as any).geminiFunctionDeclarations.length
          : 0
      },
      iterations: trace.iterations.map(it => ({
        index: it.index,
        providerLatencyMs: it.providerLatencyMs,
        toolCalls: it.toolCalls,
        resolutions: it.resolutions.map(r => ({
          callId: r.callId,
          toolId: r.toolId,
          status: r.status,
          arguments: r.arguments,
          modelResult: r.modelResult,
          durationMs: r.durationMs,
          error: r.error
        })),
        assistantText: it.assistantText
      })),
      loopStopReason: trace.loopStopReason || null,
      totalLoops: trace.totalLoops,
      totalProviderLatencyMs: trace.totalProviderLatencyMs,
      totalToolLatencyMs: trace.totalToolLatencyMs
    };

    await evaluation.update({
      status: "completed",
      shadowReply: (trace.finalText || "").slice(0, 8000),
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      providerLatencyMs: trace.totalProviderLatencyMs,
      toolLatencyMs: trace.totalToolLatencyMs,
      estimatedCostUsd,
      toolCallCount,
      loopCount: trace.totalLoops,
      usedTools,
      usedKnowledge: usedKnowledgeShadow,
      loopStopReason: trace.loopStopReason || null,
      errorCode: null,
      trace: safeTrace,
      comparison,
      toolAnalytics
    });

    recordShadowFcExecution({
      companyId: input.companyId,
      provider: input.provider,
      usedTools,
      usedKnowledge: usedKnowledgeShadow,
      toolCallCount,
      toolLatencyMs: trace.totalToolLatencyMs,
      providerLatencyMs: trace.totalProviderLatencyMs,
      tokens: totalTokens,
      costUsd: estimatedCostUsd,
      loopStopped: Boolean(trace.loopStopReason),
      selectedToolIds: trace.selectedTools.map(t => t.id),
      resolutions: toolAnalytics.calls.map(c => ({
        toolId: c.toolId,
        status: c.status,
        empty: c.empty
      }))
    });

    // 2.1F — Evidence Engine (observacional; não altera Live/mensagens)
    void (async () => {
      try {
        await evaluation.reload();
        const { scheduleEvidenceFromShadowEvaluation } = await import(
          "../../AutomationOrchestrator/evidence/EvidenceStore"
        );
        await scheduleEvidenceFromShadowEvaluation(evaluation);
      } catch (evErr) {
        logger.warn(
          { evErr, evaluationId: evaluation.id },
          "[AiAgent][shadow-fc] evidence_schedule_failed"
        );
      }
    })();

    logger.info(
      {
        companyId: input.companyId,
        evaluationId: evaluation.id,
        runtimeLogId: input.runtimeLogId,
        toolCallCount,
        latencyMs
      },
      "[AiAgent][shadow-fc] evaluation_completed"
    );

    return evaluation;
  } catch (err) {
    await evaluation.update({
      status: "failed",
      errorCode: "SHADOW_FC_FAILED",
      metadata: {
        ...(evaluation.metadata || {}),
        error: err instanceof Error ? err.message.slice(0, 300) : "unknown"
      }
    });
    logger.warn(
      { err, evaluationId: evaluation.id },
      "[AiAgent][shadow-fc] evaluation_failed"
    );
    return evaluation;
  }
}

export default { scheduleShadowFcEvaluation, runShadowFcEvaluation };
