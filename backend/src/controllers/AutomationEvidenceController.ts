import { Request, Response } from "express";
import AppError from "../errors/AppError";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return Math.floor(id);
}

export const dashboard = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceDashboardService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceDashboardService({ companyId }));
};

export const readiness = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceReadinessService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceReadinessService({ companyId }));
};

export const recommendations = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceRecommendationsService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceRecommendationsService({ companyId }));
};

export const providers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceProvidersService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceProvidersService({ companyId }));
};

export const tools = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceToolsService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceToolsService({ companyId }));
};

export const agents = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceAgentsService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceAgentsService({ companyId }));
};

export const companies = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceCompaniesService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceCompaniesService({ companyId }));
};

export const connections = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceConnectionsService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceConnectionsService({ companyId }));
};

export const thresholds = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetEvidenceThresholdsService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(await GetEvidenceThresholdsService({ companyId }));
};

export const updateThresholds = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { UpsertEvidenceThresholdsService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  return res.json(
    await UpsertEvidenceThresholdsService({
      companyId,
      thresholds: req.body?.thresholds || req.body || {}
    })
  );
};

export const showReport = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const { GetEvidenceReportService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  const report = await GetEvidenceReportService({ companyId, id });
  return res.json({ report });
};

export const byShadowEvaluation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const shadowEvaluationId = parseIdParam(req.params.shadowEvaluationId);
  const { GetEvidenceByShadowEvaluationService } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceAdminServices"
  );
  const report = await GetEvidenceByShadowEvaluationService({
    companyId,
    shadowEvaluationId
  });
  return res.json({ report });
};

/** Tester: gera evidence a partir de payload sintético (sem DB write obrigatório). */
export const testEvidence = async (
  req: Request,
  res: Response
): Promise<Response> => {
  companyIdOrThrow(req);
  if (req.body?.adminTestMode !== true) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "adminTestMode obrigatório."
    );
  }
  const { buildEvidenceReport } = await import(
    "../services/AutomationOrchestrator/evidence/AutomationEvidenceEngine"
  );
  const { computeReadinessScore, loadEvidenceThresholds } = await import(
    "../services/AutomationOrchestrator/evidence/EvidenceReadinessEngine"
  );
  const { decideRolloutAptitude } = await import(
    "../services/AutomationOrchestrator/evidence/RolloutDecisionService"
  );
  const { buildEvidenceRecommendations } = await import(
    "../services/AutomationOrchestrator/evidence/evidenceRecommendations"
  );

  const evaluation = {
    id: Number(req.body?.id) || 1,
    companyId: companyIdOrThrow(req),
    shadowReply: String(req.body?.shadowReply || ""),
    officialReply: String(req.body?.officialReply || ""),
    usedTools: req.body?.usedTools === true,
    usedKnowledge: req.body?.usedKnowledge === true,
    toolCallCount: Number(req.body?.toolCallCount) || 0,
    provider: req.body?.provider || "openai",
    model: req.body?.model || "test",
    trace: req.body?.trace || null,
    knowledgeMeta: req.body?.knowledgeMeta || null,
    metadata: req.body?.metadata || null,
    latencyMs: Number(req.body?.latencyMs) || 100,
    totalTokens: Number(req.body?.totalTokens) || 50,
    estimatedCostUsd: Number(req.body?.estimatedCostUsd) || 0.0001
  };

  const report = buildEvidenceReport(evaluation);
  const thresholds = await loadEvidenceThresholds(evaluation.companyId);
  const rates = {
    verificationRate: report.scores.verified ? 1 : 0,
    toolUtilizationRate: evaluation.toolCallCount > 0 ? 1 : 0,
    hallucinationRate: report.scores.hallucination ? 1 : 0,
    knowledgeUtilizationRate: report.scores.knowledgeVerified ? 1 : 0,
    selectionAccuracy: 1,
    averageToolCalls: evaluation.toolCallCount,
    averageLatency: evaluation.latencyMs || 0,
    averageCost: evaluation.estimatedCostUsd || 0,
    averageTokens: evaluation.totalTokens || 0,
    toolFailureRate: 0,
    toolDeniedRate: 0,
    loopStopRate: 0,
    sampleCount: 1
  };
  const readiness = computeReadinessScore(rates, thresholds);
  const decision = decideRolloutAptitude({
    companyId: evaluation.companyId,
    rates,
    readiness,
    thresholds
  });
  const recommendations = buildEvidenceRecommendations({
    rates,
    typeCounts: Object.fromEntries(
      report.summary.types.map(t => [t, 1])
    ),
    toolStats: [],
    providerStats: []
  });

  return res.json({
    report,
    readiness,
    decision,
    recommendations,
    thresholds,
    liveFunctionCallingEnabled: false
  });
};
