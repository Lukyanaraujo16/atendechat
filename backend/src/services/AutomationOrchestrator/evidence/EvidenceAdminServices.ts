import { Op } from "sequelize";
import AppError from "../../../errors/AppError";
import AiAgentEvidenceReport from "../../../models/AiAgentEvidenceReport";
import {
  DEFAULT_EVIDENCE_THRESHOLDS,
  AUTOMATION_EVIDENCE_VERSION
} from "../../../config/automationEvidenceConstants";
import {
  computeReadinessScore,
  loadEvidenceThresholds,
  saveEvidenceThresholds,
  EvidenceScoreRates
} from "./EvidenceReadinessEngine";
import { getEvidenceMetricsSnapshot } from "./EvidenceMetrics";
import { buildEvidenceRecommendations } from "./evidenceRecommendations";
import { decideRolloutAptitude } from "./RolloutDecisionService";

function ratesFromSnapshot(
  snap: ReturnType<typeof getEvidenceMetricsSnapshot>
): EvidenceScoreRates {
  return {
    verificationRate: snap.verificationRate,
    toolUtilizationRate: snap.toolUtilizationRate,
    hallucinationRate: snap.hallucinationRate,
    knowledgeUtilizationRate: snap.knowledgeUtilizationRate,
    selectionAccuracy: snap.selectionAccuracy,
    averageToolCalls: snap.averageToolCalls,
    averageLatency: snap.averageLatency,
    averageCost: snap.averageCost,
    averageTokens: snap.averageTokens,
    toolFailureRate: snap.toolFailureRate,
    toolDeniedRate: snap.toolDeniedRate,
    loopStopRate: snap.loopStopRate,
    sampleCount: snap.sampleCount
  };
}

export async function GetEvidenceDashboardService(input: {
  companyId: number;
}) {
  const snap = getEvidenceMetricsSnapshot(input.companyId);
  const thresholds = await loadEvidenceThresholds(input.companyId);
  const rates = ratesFromSnapshot(snap);
  const readiness = computeReadinessScore(rates, thresholds);
  const recommendations = buildEvidenceRecommendations({
    rates,
    typeCounts: snap.typeCounts,
    toolStats: snap.tools.map(t => ({
      toolId: t.toolId,
      usage: t.usage,
      verified: Math.round(t.verificationRate * t.usage),
      empty: Math.round(t.emptyRate * t.usage),
      failures: Math.round(t.failureRate * t.usage),
      neverUsed: t.neverUsed
    })),
    providerStats: snap.providers
  });

  const recent = await AiAgentEvidenceReport.findAll({
    where: { companyId: input.companyId },
    order: [["createdAt", "DESC"]],
    limit: 20,
    attributes: [
      "id",
      "shadowEvaluationId",
      "primaryType",
      "verified",
      "hallucination",
      "provider",
      "aiAgentId",
      "whatsappId",
      "latencyMs",
      "estimatedCostUsd",
      "createdAt"
    ]
  });

  const topProblems = Object.entries(snap.typeCounts)
    .filter(([k]) =>
      [
        "HALLUCINATION_AFTER_TOOL",
        "TOOL_UNUSED",
        "EMPTY_RESULT",
        "INVALID_TOOL_SELECTION",
        "CONFLICTING_TOOL_RESULTS",
        "KNOWLEDGE_UNUSED"
      ].includes(k)
    )
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    version: AUTOMATION_EVIDENCE_VERSION,
    liveFunctionCallingEnabled: false,
    rates,
    readiness,
    typeCounts: snap.typeCounts,
    providers: snap.providers,
    topProblems,
    recommendations,
    recent,
    thresholds
  };
}

export async function GetEvidenceReadinessService(input: {
  companyId: number;
}) {
  const snap = getEvidenceMetricsSnapshot(input.companyId);
  const thresholds = await loadEvidenceThresholds(input.companyId);
  const rates = ratesFromSnapshot(snap);
  const readiness = computeReadinessScore(rates, thresholds);
  const decision = decideRolloutAptitude({
    companyId: input.companyId,
    rates,
    readiness,
    thresholds
  });
  return {
    rates,
    readiness,
    thresholds,
    decision,
    liveFunctionCallingEnabled: false
  };
}

export async function GetEvidenceRecommendationsService(input: {
  companyId: number;
}) {
  const snap = getEvidenceMetricsSnapshot(input.companyId);
  const thresholds = await loadEvidenceThresholds(input.companyId);
  const rates = ratesFromSnapshot(snap);
  return {
    recommendations: buildEvidenceRecommendations({
      rates,
      typeCounts: snap.typeCounts,
      toolStats: snap.tools.map(t => ({
        toolId: t.toolId,
        usage: t.usage,
        verified: Math.round(t.verificationRate * t.usage),
        empty: Math.round(t.emptyRate * t.usage),
        failures: Math.round(t.failureRate * t.usage)
      })),
      providerStats: snap.providers
    }),
    thresholdsDefaults: DEFAULT_EVIDENCE_THRESHOLDS
  };
}

export async function GetEvidenceProvidersService(input: {
  companyId: number;
}) {
  const snap = getEvidenceMetricsSnapshot(input.companyId);
  return { providers: snap.providers, prepared: { claude: false } };
}

export async function GetEvidenceToolsService(input: { companyId: number }) {
  const snap = getEvidenceMetricsSnapshot(input.companyId);
  return { tools: snap.tools };
}

export async function GetEvidenceAgentsService(input: { companyId: number }) {
  const snap = getEvidenceMetricsSnapshot(input.companyId);
  const thresholds = await loadEvidenceThresholds(input.companyId);
  const agents = snap.agents.map(a => {
    const rates: EvidenceScoreRates = {
      verificationRate: a.verificationRate,
      toolUtilizationRate: a.toolUsage,
      hallucinationRate: a.hallucinationRate,
      knowledgeUtilizationRate: a.knowledgeUsage,
      selectionAccuracy: 1,
      averageToolCalls: 0,
      averageLatency: a.averageLatency,
      averageCost: a.averageCost,
      averageTokens: 0,
      toolFailureRate: 0,
      toolDeniedRate: 0,
      loopStopRate: 0,
      sampleCount: a.samples
    };
    const readiness = computeReadinessScore(rates, thresholds);
    return { ...a, readiness };
  });
  return { agents };
}

export async function GetEvidenceCompaniesService(input: {
  companyId: number;
}) {
  const dash = await GetEvidenceDashboardService(input);
  return {
    company: {
      companyId: input.companyId,
      overallReadiness: dash.readiness,
      providerComparison: dash.providers,
      toolUsage: dash.rates.toolUtilizationRate,
      knowledgeUsage: dash.rates.knowledgeUtilizationRate,
      cost: dash.rates.averageCost,
      latency: dash.rates.averageLatency,
      topProblems: dash.topProblems
    }
  };
}

export async function GetEvidenceConnectionsService(input: {
  companyId: number;
}) {
  const snap = getEvidenceMetricsSnapshot(input.companyId);
  const thresholds = await loadEvidenceThresholds(input.companyId);
  const connections = snap.connections.map(c => {
    const rates: EvidenceScoreRates = {
      verificationRate: c.verificationRate,
      toolUtilizationRate: c.toolUsage,
      hallucinationRate: c.hallucinationRate,
      knowledgeUtilizationRate: c.knowledgeUsage,
      selectionAccuracy: 1,
      averageToolCalls: 0,
      averageLatency: 0,
      averageCost: 0,
      averageTokens: 0,
      toolFailureRate: 0,
      toolDeniedRate: 0,
      loopStopRate: 0,
      sampleCount: c.samples
    };
    const readiness = computeReadinessScore(rates, thresholds);
    const topProvider =
      Object.entries(c.providers).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return {
      ...c,
      provider: topProvider,
      readiness
    };
  });
  return { connections };
}

export async function GetEvidenceReportService(input: {
  companyId: number;
  id: number;
}) {
  const row = await AiAgentEvidenceReport.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!row) {
    throw new AppError("ERR_NO_PERMISSION", 404, "Evidence report não encontrado.");
  }
  return row;
}

export async function GetEvidenceByShadowEvaluationService(input: {
  companyId: number;
  shadowEvaluationId: number;
}) {
  return AiAgentEvidenceReport.findOne({
    where: {
      companyId: input.companyId,
      shadowEvaluationId: input.shadowEvaluationId
    }
  });
}

export async function UpsertEvidenceThresholdsService(input: {
  companyId: number;
  thresholds: Record<string, unknown>;
}) {
  const saved = await saveEvidenceThresholds(input.companyId, input.thresholds);
  return { thresholds: saved, liveFunctionCallingEnabled: false };
}

export async function GetEvidenceThresholdsService(input: {
  companyId: number;
}) {
  const thresholds = await loadEvidenceThresholds(input.companyId);
  return {
    thresholds,
    defaults: DEFAULT_EVIDENCE_THRESHOLDS,
    liveFunctionCallingEnabled: false
  };
}

export async function countEvidenceSince(input: {
  companyId: number;
  since: Date;
}): Promise<number> {
  return AiAgentEvidenceReport.count({
    where: {
      companyId: input.companyId,
      createdAt: { [Op.gte]: input.since }
    }
  });
}
