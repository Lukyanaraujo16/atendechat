import { getLearningConfig, setLearningConfig } from "../LearningConfig";
import { defaultLearningEngine } from "../LearningEngine";
import { learningStore } from "../stores/LearningStore";
import { listLearningEvents } from "../LearningEvents";
import {
  getLearningMetricsBase,
  listLearningAudits
} from "../metrics/LearningMetrics";
import { evaluateLearningDataQuality } from "../collector/LearningDataQualityEvaluator";
import { detectLearningConflicts } from "../conflicts/LearningConflictDetector";
import { deduplicateLearningCandidates } from "../candidates/LearningDeduplicationService";
import { evaluateLearningCandidate } from "../evaluation/LearningEvaluationEngine";
import { decideLearningPromotion } from "../promotion/LearningPromotionPolicyEngine";
import { applyTemporalDecay } from "../decay/TemporalDecay";
import { sanitizeValue } from "../collector/LearningDataCollector";
import {
  ExecutionHistorySample,
  LearningCandidate
} from "../types";
import {
  LearningMode,
  LearningPromotionMode,
  LearningScopeType
} from "../../../../config/automationLearningConstants";
import { AUTOMATION_LEARNING_FEATURE_KEY } from "../../../../config/automationLearningConstants";
import { assertAgentOsPlanFeature } from "../../security/AgentOsPlanGate";

async function assertLearningPlan(companyId: number): Promise<void> {
  await assertAgentOsPlanFeature(companyId, AUTOMATION_LEARNING_FEATURE_KEY);
}

export async function AnalyzeLearningService(input: {
  companyId: number;
  userId?: number | null;
  body: Record<string, unknown>;
}) {
  await assertLearningPlan(input.companyId);
  const samples = (input.body.samples as ExecutionHistorySample[]) || [];
  return defaultLearningEngine.analyze({
    companyId: input.companyId,
    userId: input.userId,
    agentId: (input.body.agentId as number) ?? null,
    mode: (input.body.mode as LearningMode) || "MANUAL",
    scopeType: (input.body.scopeType as LearningScopeType) || "TENANT",
    scopeId: String(input.body.scopeId || input.companyId),
    samples
  });
}

export async function AnalyzeSessionLearningService(input: {
  companyId: number;
  userId?: number | null;
  sessionId: string;
  body: Record<string, unknown>;
}) {
  await assertLearningPlan(input.companyId);
  return defaultLearningEngine.analyzeSession({
    companyId: input.companyId,
    userId: input.userId,
    sessionId: input.sessionId,
    agentId: (input.body.agentId as number) ?? null,
    samples: (input.body.samples as ExecutionHistorySample[]) || []
  });
}

export async function AnalyzeGoalLearningService(input: {
  companyId: number;
  userId?: number | null;
  goalId: string;
  body: Record<string, unknown>;
}) {
  await assertLearningPlan(input.companyId);
  return defaultLearningEngine.analyzeGoal({
    companyId: input.companyId,
    userId: input.userId,
    goalId: input.goalId,
    agentId: (input.body.agentId as number) ?? null,
    samples: (input.body.samples as ExecutionHistorySample[]) || []
  });
}

export async function AnalyzeAgentLearningService(input: {
  companyId: number;
  userId?: number | null;
  agentId: number;
  body: Record<string, unknown>;
}) {
  await assertLearningPlan(input.companyId);
  return defaultLearningEngine.analyzeAgent({
    companyId: input.companyId,
    userId: input.userId,
    agentId: input.agentId,
    samples: (input.body.samples as ExecutionHistorySample[]) || []
  });
}

export async function ListLearningAnalysesService(input: { companyId: number }) {
  return { analyses: learningStore(input.companyId).listAnalyses() };
}

export async function GetLearningAnalysisService(input: {
  companyId: number;
  id: string;
}) {
  const analysis = learningStore(input.companyId).getAnalysis(input.id);
  if (!analysis) throw new Error("ERR_LEARNING_ANALYSIS_NOT_FOUND");
  return { analysis };
}

export async function ListLearningDatasetsService(input: { companyId: number }) {
  return { datasets: learningStore(input.companyId).listDatasets() };
}

export async function GetLearningDatasetService(input: {
  companyId: number;
  id: string;
}) {
  const dataset = learningStore(input.companyId).getDataset(input.id);
  if (!dataset) throw new Error("ERR_LEARNING_DATASET_NOT_FOUND");
  return { dataset };
}

export async function ListLearningPatternsService(input: { companyId: number }) {
  return { patterns: learningStore(input.companyId).listPatterns() };
}

export async function GetLearningPatternService(input: {
  companyId: number;
  id: string;
}) {
  const pattern = learningStore(input.companyId).getPattern(input.id);
  if (!pattern) throw new Error("ERR_LEARNING_PATTERN_NOT_FOUND");
  return { pattern };
}

export async function ListLearningCandidatesService(input: {
  companyId: number;
}) {
  return { candidates: learningStore(input.companyId).listCandidates() };
}

export async function GetLearningCandidateService(input: {
  companyId: number;
  id: string;
}) {
  const candidate = learningStore(input.companyId).getCandidate(input.id);
  if (!candidate) throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
  return { candidate };
}

export async function EvaluateLearningCandidateService(input: {
  companyId: number;
  id: string;
  userId?: number | null;
}) {
  return defaultLearningEngine.evaluateCandidate({
    companyId: input.companyId,
    candidateId: input.id,
    userId: input.userId
  });
}

export async function ApproveLearningCandidateService(input: {
  companyId: number;
  id: string;
  userId?: number | null;
  isSuperAdmin?: boolean;
}) {
  await assertLearningPlan(input.companyId);
  return defaultLearningEngine.approveCandidate({
    companyId: input.companyId,
    candidateId: input.id,
    userId: input.userId,
    isSuperAdmin: input.isSuperAdmin
  });
}

export async function RejectLearningCandidateService(input: {
  companyId: number;
  id: string;
  userId?: number | null;
  reason?: string;
}) {
  return defaultLearningEngine.rejectCandidate({
    companyId: input.companyId,
    candidateId: input.id,
    userId: input.userId,
    reason: input.reason
  });
}

export async function PromoteLearningCandidateService(input: {
  companyId: number;
  id: string;
  userId?: number | null;
  isSuperAdmin?: boolean;
  requestedMode?: LearningPromotionMode;
}) {
  await assertLearningPlan(input.companyId);
  return defaultLearningEngine.promoteCandidate({
    companyId: input.companyId,
    candidateId: input.id,
    userId: input.userId,
    isSuperAdmin: input.isSuperAdmin,
    requestedMode: input.requestedMode
  });
}

export async function InvalidateLearningCandidateService(input: {
  companyId: number;
  id: string;
  reason?: string;
}) {
  return defaultLearningEngine.invalidateCandidate({
    companyId: input.companyId,
    candidateId: input.id,
    reason: input.reason || "invalidated"
  });
}

export async function ListLearningArtifactsService(input: {
  companyId: number;
}) {
  return { artifacts: learningStore(input.companyId).listArtifacts() };
}

export async function GetLearningArtifactService(input: {
  companyId: number;
  id: string;
}) {
  const artifact = learningStore(input.companyId).getArtifact(input.id);
  if (!artifact) throw new Error("ERR_LEARNING_ARTIFACT_NOT_FOUND");
  return { artifact };
}

export async function RollbackLearningArtifactService(input: {
  companyId: number;
  id: string;
  userId?: number | null;
  reason?: string;
}) {
  await assertLearningPlan(input.companyId);
  return defaultLearningEngine.rollbackPromotion({
    companyId: input.companyId,
    artifactId: input.id,
    userId: input.userId,
    reason: input.reason
  });
}

export async function AddLearningFeedbackService(input: {
  companyId: number;
  userId: number;
  body: Record<string, unknown>;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}) {
  return defaultLearningEngine.addHumanFeedback({
    companyId: input.companyId,
    userId: input.userId,
    agentId: (input.body.agentId as number) ?? null,
    sessionId: (input.body.sessionId as string) ?? null,
    executionId: (input.body.executionId as string) ?? null,
    candidateId: (input.body.candidateId as string) ?? null,
    rating: Number(input.body.rating || 3),
    classification: (input.body.classification as any) || "USEFUL",
    comment: String(input.body.comment || ""),
    isAdmin: input.isAdmin,
    isSuperAdmin: input.isSuperAdmin
  });
}

export async function ListLearningFeedbackService(input: { companyId: number }) {
  return { feedbacks: learningStore(input.companyId).listFeedbacks() };
}

export async function ShadowLearningService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  return defaultLearningEngine.shadowCompare({
    companyId: input.companyId,
    candidateId: String(input.body.candidateId || ""),
    sourceExecutionId: String(input.body.sourceExecutionId || "hist_1"),
    originalDecision: (input.body.originalDecision as Record<string, unknown>) || {
      runtimeType: "MCP"
    }
  });
}

export async function ListLearningShadowsService(input: { companyId: number }) {
  return { shadows: learningStore(input.companyId).listShadows() };
}

export async function GetLearningShadowService(input: {
  companyId: number;
  id: string;
}) {
  const shadow = learningStore(input.companyId).getShadow(input.id);
  if (!shadow) throw new Error("ERR_LEARNING_SHADOW_NOT_FOUND");
  return { shadow };
}

export async function GetLearningDashboardService(input: { companyId: number }) {
  const store = learningStore(input.companyId);
  const candidates = store.listCandidates();
  const patterns = store.listPatterns();
  const artifacts = store.listArtifacts();
  const base = getLearningMetricsBase();
  return {
    analyses: store.listAnalyses().length,
    patterns: patterns.length,
    candidates: candidates.length,
    readyForReview: candidates.filter(c => c.status === "READY_FOR_REVIEW").length,
    approved: candidates.filter(c => c.status === "APPROVED").length,
    promoted: candidates.filter(c => c.status === "PROMOTED").length,
    rejected: candidates.filter(c => c.status === "REJECTED").length,
    rollbacks: base.candidatesRolledBack,
    conflicts: base.conflictsDetected,
    averageConfidence: base.averageCandidateConfidence,
    dataQuality: base.averageDataQuality,
    shadowImprovements: store
      .listShadows()
      .filter(s => s.evaluation === "SHADOW_DIFF").length,
    metrics: base,
    liveIntegrationEnabled: false,
    autoPromotionEnabled: false,
    productionPromotionEnabled: false,
    executesTools: false,
    executesMcp: false,
    modifiesPlanner: false,
    modifiesRuntimeLive: false
  };
}

export async function GetLearningMetricsService(input: { companyId: number }) {
  return {
    metrics: getLearningMetricsBase(),
    events: listLearningEvents(input.companyId, 30),
    audits: listLearningAudits(input.companyId, 30)
  };
}

export async function GetLearningConfigService(input: { companyId: number }) {
  return { config: getLearningConfig(input.companyId) };
}

export async function UpsertLearningConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  await assertLearningPlan(input.companyId);
  return {
    config: setLearningConfig(input.companyId, {
      ...input.config,
      autoPromotionEnabled: false,
      liveIntegrationEnabled: false,
      productionPromotionEnabled: false,
      usesGenerativeAi: false
    })
  };
}

export async function ReplayLearningService(input: {
  companyId: number;
  id: string;
}) {
  const store = learningStore(input.companyId);
  const analysis = store.getAnalysis(input.id);
  const candidate = store.getCandidate(input.id);
  const dataset = analysis?.datasetId
    ? store.getDataset(analysis.datasetId)
    : null;
  const cand = candidate || (analysis?.candidateIds[0]
    ? store.getCandidate(analysis.candidateIds[0])
    : null);
  const patterns = (analysis?.patternIds || cand?.patternIds || [])
    .map(id => store.getPattern(id))
    .filter(Boolean);
  const evaluation = cand
    ? store.listEvaluations().find(e => e.candidateId === cand.id) || null
    : null;
  const artifact = cand
    ? store.listArtifacts().find(a => a.candidateId === cand.id) || null
    : null;
  const shadow = cand
    ? store.listShadows().find(s => s.candidateId === cand.id) || null
    : null;

  return {
    replay: {
      analysis,
      dataset,
      patterns,
      candidate: cand,
      evaluation,
      artifact,
      shadow,
      knowledgeObjectId: artifact?.knowledgeObjectId || null,
      guidance: {
        planner: store.listPlannerGuidance(),
        runtime: store.listRuntimeGuidance(),
        strategy: store.listStrategyGuidance()
      },
      timeline: listLearningEvents(input.companyId, 50).filter(
        e =>
          e.subjectId === input.id ||
          e.subjectId === cand?.id ||
          e.subjectId === artifact?.id ||
          e.subjectId === analysis?.id
      )
    }
  };
}

// Tester helpers
export async function SimulateLearningQualityService(input: {
  companyId: number;
  body: Record<string, unknown>;
}) {
  return {
    quality: evaluateLearningDataQuality({
      companyId: input.companyId,
      sampleSize: Number(input.body.sampleSize || 0),
      evidence: (input.body.evidence as any[]) || [],
      successCount: Number(input.body.successCount || 0),
      failureCount: Number(input.body.failureCount || 0),
      partialCount: Number(input.body.partialCount || 0),
      humanInterventionCount: Number(input.body.humanInterventionCount || 0),
      uniqueCapabilities: Number(input.body.uniqueCapabilities || 1),
      uniqueSessions: Number(input.body.uniqueSessions || 1)
    })
  };
}

export async function SimulateLearningConflictsService(input: {
  companyId: number;
  candidateId: string;
}) {
  const store = learningStore(input.companyId);
  const candidate = store.getCandidate(input.candidateId);
  if (!candidate) throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
  return {
    conflicts: detectLearningConflicts({
      companyId: input.companyId,
      candidate,
      others: store.listCandidates()
    })
  };
}

export async function SimulateLearningDedupService(input: {
  companyId: number;
  candidates: LearningCandidate[];
}) {
  return deduplicateLearningCandidates({
    companyId: input.companyId,
    existing: learningStore(input.companyId).listCandidates(),
    incoming: input.candidates || []
  });
}

export async function SimulateLearningPromotionPolicyService(input: {
  companyId: number;
  candidateId: string;
  isSuperAdmin?: boolean;
  requestedMode?: LearningPromotionMode;
}) {
  const store = learningStore(input.companyId);
  const candidate = store.getCandidate(input.candidateId);
  if (!candidate) throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
  const evaluation =
    store.listEvaluations().find(e => e.candidateId === candidate.id) ||
    evaluateLearningCandidate({ companyId: input.companyId, candidate });
  return {
    decision: decideLearningPromotion({
      companyId: input.companyId,
      candidate: { ...candidate, status: "APPROVED" },
      evaluation,
      isSuperAdmin: input.isSuperAdmin,
      explicitApprove: true,
      requestedMode: input.requestedMode || "SHADOW"
    })
  };
}

export async function SimulateLearningDecayService(input: {
  companyId: number;
  candidateId: string;
}) {
  const candidate = learningStore(input.companyId).getCandidate(input.candidateId);
  if (!candidate) throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
  return applyTemporalDecay({ companyId: input.companyId, candidate });
}

export async function SanitizeLearningPayloadService(input: {
  payload: unknown;
}) {
  return { sanitized: sanitizeValue(input.payload) };
}

export async function ListLearningGuidanceService(input: { companyId: number }) {
  const store = learningStore(input.companyId);
  return {
    planner: store.listPlannerGuidance(),
    runtime: store.listRuntimeGuidance(),
    strategy: store.listStrategyGuidance()
  };
}

export default {
  AnalyzeLearningService,
  GetLearningDashboardService
};
