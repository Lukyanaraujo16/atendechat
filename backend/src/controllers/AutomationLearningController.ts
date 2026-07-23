import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { AUTOMATION_LEARNING_FEATURE_KEY } from "../config/automationLearningConstants";
import { assertAgentOsPlanFeature } from "../services/AutomationOrchestrator/security/AgentOsPlanGate";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function userIdOrNull(req: Request): number | null {
  const id = req.user?.id;
  if (id == null) return null;
  return typeof id === "number" ? id : Number(id);
}

function isSuperAdmin(req: Request): boolean {
  return Boolean((req.user as any)?.super || (req.user as any)?.profile === "super");
}

async function assertLearningPlan(companyId: number): Promise<void> {
  await assertAgentOsPlanFeature(companyId, AUTOMATION_LEARNING_FEATURE_KEY);
}

function mapErr(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("ERR_LEARNING_") || msg.startsWith("ERR_NO_PERMISSION")) {
    throw new AppError(msg.split(":")[0], 400, msg);
  }
  throw err;
}

export const analyze = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  await assertLearningPlan(companyId);
  try {
    const { AnalyzeLearningService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await AnalyzeLearningService({
        companyId,
        userId: userIdOrNull(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const analyzeSession = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { AnalyzeSessionLearningService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await AnalyzeSessionLearningService({
        companyId,
        userId: userIdOrNull(req),
        sessionId: String(req.params.sessionId),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const analyzeGoal = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { AnalyzeGoalLearningService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await AnalyzeGoalLearningService({
        companyId,
        userId: userIdOrNull(req),
        goalId: String(req.params.goalId),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const analyzeAgent = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { AnalyzeAgentLearningService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await AnalyzeAgentLearningService({
        companyId,
        userId: userIdOrNull(req),
        agentId: Number(req.params.agentId),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listAnalyses = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListLearningAnalysesService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await ListLearningAnalysesService({ companyId }));
};

export const getAnalysis = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { GetLearningAnalysisService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await GetLearningAnalysisService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listDatasets = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListLearningDatasetsService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await ListLearningDatasetsService({ companyId }));
};

export const getDataset = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { GetLearningDatasetService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await GetLearningDatasetService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listPatterns = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListLearningPatternsService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await ListLearningPatternsService({ companyId }));
};

export const getPattern = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { GetLearningPatternService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await GetLearningPatternService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listCandidates = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListLearningCandidatesService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await ListLearningCandidatesService({ companyId }));
};

export const getCandidate = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { GetLearningCandidateService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await GetLearningCandidateService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const evaluateCandidate = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { EvaluateLearningCandidateService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await EvaluateLearningCandidateService({
        companyId,
        id: String(req.params.id),
        userId: userIdOrNull(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const approveCandidate = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { ApproveLearningCandidateService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await ApproveLearningCandidateService({
        companyId,
        id: String(req.params.id),
        userId: userIdOrNull(req),
        isSuperAdmin: isSuperAdmin(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const rejectCandidate = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { RejectLearningCandidateService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await RejectLearningCandidateService({
        companyId,
        id: String(req.params.id),
        userId: userIdOrNull(req),
        reason: req.body?.reason
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const promoteCandidate = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { PromoteLearningCandidateService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await PromoteLearningCandidateService({
        companyId,
        id: String(req.params.id),
        userId: userIdOrNull(req),
        isSuperAdmin: isSuperAdmin(req),
        requestedMode: req.body?.requestedMode || "SHADOW"
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const invalidateCandidate = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { InvalidateLearningCandidateService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await InvalidateLearningCandidateService({
        companyId,
        id: String(req.params.id),
        reason: req.body?.reason
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listArtifacts = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListLearningArtifactsService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await ListLearningArtifactsService({ companyId }));
};

export const getArtifact = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { GetLearningArtifactService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await GetLearningArtifactService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const rollbackArtifact = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { RollbackLearningArtifactService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await RollbackLearningArtifactService({
        companyId,
        id: String(req.params.id),
        userId: userIdOrNull(req),
        reason: req.body?.reason
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const addFeedback = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const userId = userIdOrNull(req);
  if (userId == null) throw new AppError("ERR_NO_PERMISSION", 403);
  try {
    const { AddLearningFeedbackService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await AddLearningFeedbackService({
        companyId,
        userId,
        body: req.body || {},
        isAdmin: true,
        isSuperAdmin: isSuperAdmin(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listFeedback = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListLearningFeedbackService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await ListLearningFeedbackService({ companyId }));
};

export const shadow = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { ShadowLearningService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await ShadowLearningService({ companyId, body: req.body || {} })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listShadows = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListLearningShadowsService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await ListLearningShadowsService({ companyId }));
};

export const getShadow = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { GetLearningShadowService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await GetLearningShadowService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const metrics = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { GetLearningMetricsService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await GetLearningMetricsService({ companyId }));
};

export const dashboard = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { GetLearningDashboardService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await GetLearningDashboardService({ companyId }));
};

export const replay = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { ReplayLearningService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await ReplayLearningService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const getConfig = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { GetLearningConfigService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await GetLearningConfigService({ companyId }));
};

export const putConfig = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { UpsertLearningConfigService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await UpsertLearningConfigService({
        companyId,
        config: req.body?.config || req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listGuidance = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListLearningGuidanceService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(await ListLearningGuidanceService({ companyId }));
};

export const simulateQuality = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { SimulateLearningQualityService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(
    await SimulateLearningQualityService({ companyId, body: req.body || {} })
  );
};

export const simulateConflicts = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { SimulateLearningConflictsService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await SimulateLearningConflictsService({
        companyId,
        candidateId: String(req.body?.candidateId || req.params.id || "")
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulatePromotion = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { SimulateLearningPromotionPolicyService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await SimulateLearningPromotionPolicyService({
        companyId,
        candidateId: String(req.body?.candidateId || ""),
        isSuperAdmin: isSuperAdmin(req),
        requestedMode: req.body?.requestedMode
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulateDecay = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { SimulateLearningDecayService } = await import(
      "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
    );
    return res.json(
      await SimulateLearningDecayService({
        companyId,
        candidateId: String(req.body?.candidateId || "")
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const sanitizePayload = async (req: Request, res: Response) => {
  companyIdOrThrow(req);
  const { SanitizeLearningPayloadService } = await import(
    "../services/AutomationOrchestrator/learning/admin/LearningAdminServices"
  );
  return res.json(
    await SanitizeLearningPayloadService({ payload: req.body?.payload })
  );
};
