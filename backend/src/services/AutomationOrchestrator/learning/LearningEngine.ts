import { promoteLearningCandidate } from "./promotion/LearningPromotionPolicyEngine";
import { rollbackLearningArtifact } from "./promotion/LearningRollbackService";
import {
  applyTemporalDecay,
  invalidateLearningCandidate
} from "./decay/TemporalDecay";
import { runLearningShadowComparison } from "./shadow/LearningShadowService";
import { createHumanLearningFeedback } from "./feedback/HumanLearningFeedbackService";
import { emitLearningEvent } from "./LearningEvents";
import {
  recordEvaluationScore,
  recordLearningAudit,
  recordLearningConfidence,
  recordLearningMetric,
  recordLearningQuality
} from "./metrics/LearningMetrics";
import { learningStore } from "./stores/LearningStore";
import {
  ExecutionHistorySample,
  LearningAnalysis,
  LearningCandidate,
  LearningEvaluationReport
} from "./types";
import { CognitiveMemoryEngine } from "../cognitive/memory/CognitiveMemoryEngine";
import {
  HumanFeedbackClassification,
  LearningMode,
  LearningPromotionMode,
  LearningScopeType
} from "../../../config/automationLearningConstants";
import { getLearningConfig } from "./LearningConfig";
import { collectLearningDataset } from "./collector/LearningDataCollector";
import { detectLearningPatterns } from "./patterns/PatternDetectionEngine";
import { buildLearningCandidates } from "./candidates/LearningCandidateBuilder";
import { deduplicateLearningCandidates } from "./candidates/LearningDeduplicationService";
import { evaluateLearningCandidate } from "./evaluation/LearningEvaluationEngine";
import { detectLearningConflicts } from "./conflicts/LearningConflictDetector";
import { createHash } from "crypto";

function aid(seed: string): string {
  return `lana_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

/**
 * LearningEngine — orquestra análise → candidatos → aprovação → shadow promote.
 * Não altera Planner/Runtime Live. Não executa tools/MCP.
 */
export class LearningEngine {
  constructor(private readonly memory = new CognitiveMemoryEngine()) {}

  async analyze(input: {
    companyId: number;
    agentId?: number | null;
    userId?: number | null;
    mode?: LearningMode;
    scopeType: LearningScopeType;
    scopeId: string;
    samples: ExecutionHistorySample[];
  }) {
    const cfg = getLearningConfig(input.companyId);
    if (!cfg.enabled) throw new Error("ERR_LEARNING_DISABLED");
    if (input.mode === "PRODUCTION") {
      throw new Error("ERR_LEARNING_PRODUCTION_DISABLED");
    }

    const mode: LearningMode =
      input.mode ||
      (cfg.analysisMode === "PRODUCTION" ? "MANUAL" : cfg.analysisMode);

    const store = learningStore(input.companyId);
    const analysis: LearningAnalysis = {
      id: aid(`${input.companyId}:${input.scopeType}:${Date.now()}`),
      companyId: input.companyId,
      agentId: input.agentId ?? null,
      mode,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      datasetId: null,
      patternIds: [],
      candidateIds: [],
      status: "STARTED",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      errorCode: null,
      metadata: {
        executesTools: false,
        executesMcp: false,
        modifiesPlanner: false,
        modifiesRuntimeLive: false
      }
    };
    store.putAnalysis(analysis);
    recordLearningMetric("analysesStarted");
    emitLearningEvent(input.companyId, "LEARNING_ANALYSIS_STARTED", analysis.id);

    try {
      const dataset = collectLearningDataset({
        companyId: input.companyId,
        agentId: input.agentId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        samples: input.samples
      });
      store.putDataset(dataset);
      analysis.datasetId = dataset.id;
      recordLearningMetric("datasetsCreated");
      recordLearningQuality(dataset.dataQuality.score);
      emitLearningEvent(
        input.companyId,
        "LEARNING_DATASET_CREATED",
        dataset.id,
        { sampleSize: dataset.sampleSize, quality: dataset.dataQuality.level }
      );

      const patterns = detectLearningPatterns({
        companyId: input.companyId,
        agentId: input.agentId,
        dataset,
        samples: input.samples
      });
      for (const p of patterns) {
        store.putPattern(p);
        recordLearningMetric("patternsDetected", 1, { type: p.patternType });
        emitLearningEvent(
          input.companyId,
          "LEARNING_PATTERN_DETECTED",
          p.id,
          { patternType: p.patternType }
        );
      }
      analysis.patternIds = patterns.map(p => p.id);

      const built = buildLearningCandidates({
        companyId: input.companyId,
        agentId: input.agentId,
        dataset,
        patterns,
        createdBy: input.userId
      });
      const { created, updated } = deduplicateLearningCandidates({
        companyId: input.companyId,
        existing: store.listCandidates(),
        incoming: built
      });

      const candidates: LearningCandidate[] = [];
      for (const c of [...created, ...updated]) {
        store.putCandidate(c);
        candidates.push(c);
        if (created.includes(c)) {
          recordLearningMetric("candidatesCreated", 1, {
            type: c.candidateType,
            agentId: c.agentId,
            capability: String(c.proposedChange.capability || c.target)
          });
          recordLearningConfidence(c.confidence);
          emitLearningEvent(
            input.companyId,
            "LEARNING_CANDIDATE_CREATED",
            c.id
          );
        } else {
          emitLearningEvent(
            input.companyId,
            "LEARNING_CANDIDATE_UPDATED",
            c.id
          );
        }
      }
      analysis.candidateIds = candidates.map(c => c.id);

      analysis.status = "COMPLETED";
      analysis.finishedAt = new Date().toISOString();
      store.putAnalysis(analysis);
      recordLearningMetric("analysesCompleted");
      emitLearningEvent(
        input.companyId,
        "LEARNING_ANALYSIS_COMPLETED",
        analysis.id,
        { patterns: patterns.length, candidates: candidates.length }
      );

      recordLearningAudit({
        companyId: input.companyId,
        agentId: input.agentId ?? null,
        userId: input.userId ?? null,
        datasetId: dataset.id,
        patternId: null,
        candidateId: null,
        evaluationId: null,
        artifactId: null,
        action: "analyze",
        previousStatus: "STARTED",
        newStatus: "COMPLETED",
        reason: `mode=${mode}`,
        approvalMode: null,
        evidenceSummary: `samples=${dataset.sampleSize} quality=${dataset.dataQuality.level}`,
        timestamp: new Date().toISOString(),
        metadataSanitized: { mode, scopeType: input.scopeType }
      });

      return { analysis, dataset, patterns, candidates };
    } catch (err) {
      analysis.status = "FAILED";
      analysis.errorCode =
        err instanceof Error ? err.message : "ERR_LEARNING_ANALYSIS_FAILED";
      analysis.finishedAt = new Date().toISOString();
      store.putAnalysis(analysis);
      throw err;
    }
  }

  async analyzeSession(input: {
    companyId: number;
    sessionId: string;
    samples: ExecutionHistorySample[];
    userId?: number | null;
    agentId?: number | null;
  }) {
    return this.analyze({
      ...input,
      scopeType: "SESSION",
      scopeId: input.sessionId,
      mode: "POST_EXECUTION_SIMULATED"
    });
  }

  async analyzeGoal(input: {
    companyId: number;
    goalId: string;
    samples: ExecutionHistorySample[];
    userId?: number | null;
    agentId?: number | null;
  }) {
    return this.analyze({
      ...input,
      scopeType: "GOAL",
      scopeId: input.goalId,
      mode: "MANUAL"
    });
  }

  async analyzeAgent(input: {
    companyId: number;
    agentId: number;
    samples: ExecutionHistorySample[];
    userId?: number | null;
  }) {
    return this.analyze({
      ...input,
      agentId: input.agentId,
      scopeType: "AGENT",
      scopeId: String(input.agentId),
      mode: "MANUAL"
    });
  }

  async analyzeTenant(input: {
    companyId: number;
    samples: ExecutionHistorySample[];
    userId?: number | null;
  }) {
    return this.analyze({
      ...input,
      scopeType: "TENANT",
      scopeId: String(input.companyId),
      mode: "MANUAL"
    });
  }

  getCandidate(companyId: number, id: string) {
    return learningStore(companyId).getCandidate(id);
  }

  listCandidates(companyId: number) {
    return learningStore(companyId).listCandidates();
  }

  evaluateCandidate(input: {
    companyId: number;
    candidateId: string;
    userId?: number | null;
  }) {
    const store = learningStore(input.companyId);
    const candidate = store.getCandidate(input.candidateId);
    if (!candidate || candidate.companyId !== input.companyId) {
      throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
    }
    const decayed = applyTemporalDecay({
      companyId: input.companyId,
      candidate
    });
    store.putCandidate(decayed.candidate);

    const conflicts = detectLearningConflicts({
      companyId: input.companyId,
      candidate: decayed.candidate,
      others: store.listCandidates()
    });
    if (conflicts.length) {
      recordLearningMetric("conflictsDetected", conflicts.length);
      emitLearningEvent(
        input.companyId,
        "LEARNING_CONFLICT_DETECTED",
        candidate.id,
        { conflicts }
      );
    }

    const evaluating = {
      ...decayed.candidate,
      status: "EVALUATING" as const,
      updatedAt: new Date().toISOString()
    };
    store.putCandidate(evaluating);

    const report = evaluateLearningCandidate({
      companyId: input.companyId,
      candidate: evaluating,
      conflicts
    });
    store.putEvaluation(report);
    recordEvaluationScore(
      (report.qualityScore + report.confidenceScore + report.evidenceScore) / 3
    );

    const nextStatus =
      report.decision === "INSUFFICIENT_DATA" ||
      report.decision === "REQUIRES_MORE_OBSERVATION"
        ? ("DRAFT" as const)
        : report.decision === "REJECTED"
          ? ("REJECTED" as const)
          : ("READY_FOR_REVIEW" as const);

    const updated = {
      ...evaluating,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...evaluating.metadata,
        lastEvaluationId: report.id,
        lastEvaluationDecision: report.decision
      }
    };
    store.putCandidate(updated);
    emitLearningEvent(
      input.companyId,
      "LEARNING_CANDIDATE_EVALUATED",
      updated.id,
      { decision: report.decision }
    );
    recordLearningAudit({
      companyId: input.companyId,
      agentId: updated.agentId,
      userId: input.userId ?? null,
      datasetId: null,
      patternId: updated.patternIds[0] || null,
      candidateId: updated.id,
      evaluationId: report.id,
      artifactId: null,
      action: "evaluate",
      previousStatus: "EVALUATING",
      newStatus: nextStatus,
      reason: report.decision,
      approvalMode: null,
      evidenceSummary: report.reasonCodes.join(","),
      timestamp: new Date().toISOString(),
      metadataSanitized: { decision: report.decision }
    });
    return { candidate: updated, evaluation: report, conflicts };
  }

  approveCandidate(input: {
    companyId: number;
    candidateId: string;
    userId?: number | null;
    isSuperAdmin?: boolean;
  }) {
    const store = learningStore(input.companyId);
    const candidate = store.getCandidate(input.candidateId);
    if (!candidate || candidate.companyId !== input.companyId) {
      throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
    }
    if (!["READY_FOR_REVIEW", "DRAFT", "EVALUATING"].includes(candidate.status)) {
      throw new Error("ERR_LEARNING_INVALID_STATUS");
    }
    const cfg = getLearningConfig(input.companyId);
    if (
      candidate.risk >= cfg.riskThresholds.high &&
      cfg.superadminApprovalForHighRisk &&
      !input.isSuperAdmin
    ) {
      throw new Error("ERR_LEARNING_SUPERADMIN_REQUIRED");
    }
    const updated: LearningCandidate = {
      ...candidate,
      status: "APPROVED",
      reviewedBy: input.userId ?? null,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.putCandidate(updated);
    recordLearningMetric("candidatesApproved");
    emitLearningEvent(
      input.companyId,
      "LEARNING_CANDIDATE_APPROVED",
      updated.id
    );
    recordLearningAudit({
      companyId: input.companyId,
      agentId: updated.agentId,
      userId: input.userId ?? null,
      datasetId: null,
      patternId: null,
      candidateId: updated.id,
      evaluationId: null,
      artifactId: null,
      action: "approve",
      previousStatus: candidate.status,
      newStatus: "APPROVED",
      reason: "admin_approve",
      approvalMode: input.isSuperAdmin ? "SUPERADMIN_APPROVED" : "ADMIN_APPROVED",
      evidenceSummary: updated.title,
      timestamp: new Date().toISOString(),
      metadataSanitized: {}
    });
    return { candidate: updated };
  }

  rejectCandidate(input: {
    companyId: number;
    candidateId: string;
    userId?: number | null;
    reason?: string;
  }) {
    const store = learningStore(input.companyId);
    const candidate = store.getCandidate(input.candidateId);
    if (!candidate || candidate.companyId !== input.companyId) {
      throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
    }
    const updated: LearningCandidate = {
      ...candidate,
      status: "REJECTED",
      reviewedBy: input.userId ?? null,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ...candidate.metadata,
        rejectReason: input.reason || "rejected"
      }
    };
    store.putCandidate(updated);
    recordLearningMetric("candidatesRejected");
    emitLearningEvent(
      input.companyId,
      "LEARNING_CANDIDATE_REJECTED",
      updated.id
    );
    return { candidate: updated };
  }

  async promoteCandidate(input: {
    companyId: number;
    candidateId: string;
    userId?: number | null;
    isSuperAdmin?: boolean;
    requestedMode?: LearningPromotionMode;
  }) {
    const store = learningStore(input.companyId);
    const candidate = store.getCandidate(input.candidateId);
    if (!candidate || candidate.companyId !== input.companyId) {
      throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
    }
    const evaluations = store
      .listEvaluations()
      .filter(e => e.candidateId === candidate.id);
    const evaluation: LearningEvaluationReport =
      evaluations[0] ||
      evaluateLearningCandidate({
        companyId: input.companyId,
        candidate
      });

    // Block any production/live
    const cfg = getLearningConfig(input.companyId);
    if (cfg.productionPromotionEnabled || cfg.liveIntegrationEnabled) {
      throw new Error("ERR_LEARNING_LIVE_PROMOTION_FORBIDDEN");
    }
    if (cfg.autoPromotionEnabled) {
      throw new Error("ERR_LEARNING_AUTO_PROMOTION_DISABLED");
    }

    const result = await promoteLearningCandidate({
      companyId: input.companyId,
      candidate,
      evaluation,
      userId: input.userId,
      isSuperAdmin: input.isSuperAdmin,
      requestedMode: input.requestedMode || "SHADOW",
      memory: this.memory
    });

    if (!result.decision.allowed || !result.artifact) {
      return result;
    }

    store.putArtifact(result.artifact);
    if (result.guidance.planner) {
      store.putPlannerGuidance(result.artifact.id, result.guidance.planner);
    }
    if (result.guidance.runtime) {
      store.putRuntimeGuidance(result.artifact.id, result.guidance.runtime);
    }
    if (result.guidance.strategy) {
      store.putStrategyGuidance(result.artifact.id, result.guidance.strategy);
    }

    const promoted: LearningCandidate = {
      ...candidate,
      status: "PROMOTED",
      promotedAt: result.artifact.promotedAt,
      updatedAt: new Date().toISOString()
    };
    store.putCandidate(promoted);
    recordLearningMetric("candidatesPromoted", 1, {
      type: candidate.candidateType
    });
    emitLearningEvent(
      input.companyId,
      "LEARNING_CANDIDATE_PROMOTED",
      promoted.id,
      { artifactId: result.artifact.id, environment: result.artifact.environment }
    );
    emitLearningEvent(
      input.companyId,
      "LEARNING_ARTIFACT_CREATED",
      result.artifact.id
    );
    emitLearningEvent(
      input.companyId,
      "LEARNING_ARTIFACT_ACTIVATED",
      result.artifact.id
    );

    return { ...result, candidate: promoted };
  }

  rollbackPromotion(input: {
    companyId: number;
    artifactId: string;
    userId?: number | null;
    reason?: string;
  }) {
    const store = learningStore(input.companyId);
    const artifact = store.getArtifact(input.artifactId);
    if (!artifact || artifact.companyId !== input.companyId) {
      throw new Error("ERR_LEARNING_ARTIFACT_NOT_FOUND");
    }
    const candidate = store.getCandidate(artifact.candidateId);
    const rolled = rollbackLearningArtifact({
      artifact,
      candidate,
      reason: input.reason || "rollback",
      userId: input.userId
    });
    store.putArtifact(rolled.artifact);
    if (rolled.candidate) store.putCandidate(rolled.candidate);
    recordLearningMetric("candidatesRolledBack");
    emitLearningEvent(
      input.companyId,
      "LEARNING_ARTIFACT_ROLLED_BACK",
      artifact.id
    );
    return rolled;
  }

  invalidateCandidate(input: {
    companyId: number;
    candidateId: string;
    reason: string;
  }) {
    const store = learningStore(input.companyId);
    const candidate = store.getCandidate(input.candidateId);
    if (!candidate || candidate.companyId !== input.companyId) {
      throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
    }
    const updated = invalidateLearningCandidate(candidate, input.reason);
    store.putCandidate(updated);
    recordLearningMetric("candidatesInvalidated");
    emitLearningEvent(
      input.companyId,
      "LEARNING_CANDIDATE_INVALIDATED",
      updated.id,
      { reason: input.reason }
    );
    return { candidate: updated };
  }

  addHumanFeedback(input: {
    companyId: number;
    userId: number;
    agentId?: number | null;
    sessionId?: string | null;
    executionId?: string | null;
    candidateId?: string | null;
    rating: number;
    classification: HumanFeedbackClassification;
    comment?: string;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
  }) {
    const fb = createHumanLearningFeedback(input);
    learningStore(input.companyId).putFeedback(fb);
    recordLearningMetric("humanFeedbacks");
    emitLearningEvent(
      input.companyId,
      "LEARNING_HUMAN_FEEDBACK_ADDED",
      fb.id
    );
    return { feedback: fb };
  }

  shadowCompare(input: {
    companyId: number;
    candidateId: string;
    sourceExecutionId: string;
    originalDecision: Record<string, unknown>;
  }) {
    const store = learningStore(input.companyId);
    const candidate = store.getCandidate(input.candidateId);
    if (!candidate || candidate.companyId !== input.companyId) {
      throw new Error("ERR_LEARNING_CANDIDATE_NOT_FOUND");
    }
    const artifact =
      store.listArtifacts().find(a => a.candidateId === candidate.id) || null;
    const comparison = runLearningShadowComparison({
      companyId: input.companyId,
      candidate,
      artifact,
      sourceExecutionId: input.sourceExecutionId,
      originalDecision: input.originalDecision
    });
    store.putShadow(comparison);
    recordLearningMetric("shadowApplications");
    emitLearningEvent(
      input.companyId,
      "LEARNING_SHADOW_APPLIED",
      comparison.id
    );
    return { comparison };
  }
}

export const defaultLearningEngine = new LearningEngine();

export default defaultLearningEngine;
