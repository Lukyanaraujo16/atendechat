import { logger } from "../../../utils/logger";
import AiAgentEvidenceReport from "../../../models/AiAgentEvidenceReport";
import AiAgentShadowEvaluation from "../../../models/AiAgentShadowEvaluation";
import { buildEvidenceReport } from "./AutomationEvidenceEngine";
import { AUTOMATION_EVIDENCE_VERSION } from "../../../config/automationEvidenceConstants";
import { recordEvidenceReport } from "./EvidenceMetrics";

/**
 * Persiste EvidenceReport a partir de ShadowEvaluation.
 * Idempotente por shadowEvaluationId.
 */
export async function persistEvidenceFromShadowEvaluation(
  evaluation: AiAgentShadowEvaluation
): Promise<AiAgentEvidenceReport | null> {
  if (!evaluation || evaluation.status !== "completed") {
    return null;
  }

  const existing = await AiAgentEvidenceReport.findOne({
    where: {
      companyId: evaluation.companyId,
      shadowEvaluationId: evaluation.id
    }
  });
  if (existing) return existing;

  const payload = buildEvidenceReport({
    id: evaluation.id,
    companyId: evaluation.companyId,
    aiAgentId: evaluation.aiAgentId,
    whatsappId: evaluation.whatsappId,
    provider: evaluation.provider,
    model: evaluation.model,
    shadowReply: evaluation.shadowReply,
    officialReply: evaluation.officialReply,
    usedTools: evaluation.usedTools,
    usedKnowledge: evaluation.usedKnowledge,
    toolCallCount: evaluation.toolCallCount,
    loopStopReason: evaluation.loopStopReason,
    status: evaluation.status,
    latencyMs: evaluation.latencyMs,
    totalTokens: evaluation.totalTokens,
    estimatedCostUsd: evaluation.estimatedCostUsd,
    toolAnalytics: evaluation.toolAnalytics,
    knowledgeMeta: evaluation.knowledgeMeta,
    trace: evaluation.trace,
    metadata: evaluation.metadata
  });

  const row = await AiAgentEvidenceReport.create({
    companyId: evaluation.companyId,
    shadowEvaluationId: evaluation.id,
    aiAgentId: evaluation.aiAgentId,
    whatsappId: evaluation.whatsappId,
    provider: evaluation.provider,
    model: evaluation.model,
    primaryType: payload.primaryType,
    verified: payload.scores.verified,
    hallucination: payload.scores.hallucination,
    knowledgeVerified: payload.scores.knowledgeVerified,
    knowledgeUnused: payload.scores.knowledgeUnused,
    emptyResult: payload.scores.emptyResult,
    toolUnused: payload.scores.toolUnused,
    latencyMs: evaluation.latencyMs,
    totalTokens: evaluation.totalTokens,
    estimatedCostUsd: evaluation.estimatedCostUsd,
    toolCallCount: evaluation.toolCallCount || 0,
    loopStopReason: evaluation.loopStopReason,
    report: payload as unknown as Record<string, unknown>,
    metadata: {
      version: AUTOMATION_EVIDENCE_VERSION,
      observational: true,
      liveEnabled: false
    }
  });

  recordEvidenceReport({
    companyId: evaluation.companyId,
    aiAgentId: evaluation.aiAgentId,
    whatsappId: evaluation.whatsappId,
    provider: evaluation.provider,
    primaryType: payload.primaryType,
    verified: payload.scores.verified,
    hallucination: payload.scores.hallucination,
    knowledgeVerified: payload.scores.knowledgeVerified,
    knowledgeUnused: payload.scores.knowledgeUnused,
    emptyResult: payload.scores.emptyResult,
    toolUnused: payload.scores.toolUnused,
    toolCallCount: evaluation.toolCallCount || 0,
    latencyMs: evaluation.latencyMs,
    tokens: evaluation.totalTokens,
    costUsd: evaluation.estimatedCostUsd,
    loopStopped: Boolean(evaluation.loopStopReason),
    toolIds: payload.summary.toolIds,
    findings: payload.findings
  });

  logger.info(
    {
      companyId: evaluation.companyId,
      evidenceId: row.id,
      shadowEvaluationId: evaluation.id,
      primaryType: payload.primaryType
    },
    "[Evidence] report_persisted"
  );

  return row;
}

export async function scheduleEvidenceFromShadowEvaluation(
  evaluation: AiAgentShadowEvaluation
): Promise<void> {
  void persistEvidenceFromShadowEvaluation(evaluation).catch(err => {
    logger.warn(
      { err, shadowEvaluationId: evaluation?.id },
      "[Evidence] persist_failed"
    );
  });
}

export default {
  persistEvidenceFromShadowEvaluation,
  scheduleEvidenceFromShadowEvaluation
};
