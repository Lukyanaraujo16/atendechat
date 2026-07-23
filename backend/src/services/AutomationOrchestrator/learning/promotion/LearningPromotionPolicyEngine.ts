import { createHash } from "crypto";
import { getLearningConfig } from "../LearningConfig";
import {
  LearningArtifact,
  LearningCandidate,
  LearningEvaluationReport,
  PlannerGuidance,
  RuntimeLearningGuidance,
  StrategyLearningGuidance
} from "../types";
import { LearningPromotionMode } from "../../../../config/automationLearningConstants";
import { CognitiveMemoryEngine } from "../../cognitive/memory/CognitiveMemoryEngine";
import { KnowledgeObject } from "../../cognitive/memory/memoryTypes";

export type PromotionDecision = {
  allowed: boolean;
  mode: LearningPromotionMode | null;
  reasonCodes: string[];
  environment: "SHADOW" | "ADMIN_TEST" | "SIMULATION" | null;
};

/**
 * LearningPromotionPolicyEngine — nunca promove para Live/produção real.
 */
export function decideLearningPromotion(input: {
  companyId: number;
  candidate: LearningCandidate;
  evaluation: LearningEvaluationReport;
  isSuperAdmin?: boolean;
  explicitApprove?: boolean;
  requestedMode?: LearningPromotionMode;
}): PromotionDecision {
  const cfg = getLearningConfig(input.companyId);
  const reasonCodes: string[] = [];

  if (!cfg.enabled) {
    return { allowed: false, mode: null, reasonCodes: ["learning_disabled"], environment: null };
  }
  if (cfg.autoPromotionEnabled) {
    // hard lock even if misconfigured
    reasonCodes.push("auto_promotion_forced_off");
  }
  if (!input.explicitApprove) {
    return {
      allowed: false,
      mode: null,
      reasonCodes: ["explicit_approval_required"],
      environment: null
    };
  }
  if (input.candidate.status !== "APPROVED") {
    return {
      allowed: false,
      mode: null,
      reasonCodes: ["candidate_not_approved"],
      environment: null
    };
  }
  if (input.candidate.confidence < cfg.minimumPromotionConfidence) {
    reasonCodes.push("confidence_below_promotion_threshold");
  }
  if (input.candidate.risk > cfg.maximumPromotionRisk) {
    reasonCodes.push("risk_above_maximum");
  }
  if (!input.evaluation.metadata || input.candidate.dataQuality === "INSUFFICIENT") {
    reasonCodes.push("data_quality_blocks_promotion");
  }
  if (input.candidate.risk >= cfg.riskThresholds.high && !input.isSuperAdmin) {
    return {
      allowed: false,
      mode: null,
      reasonCodes: [...reasonCodes, "superadmin_required_for_high_risk"],
      environment: null
    };
  }

  const requested = input.requestedMode || "SHADOW";
  if (requested === "AUTO_SAFE" || !cfg.allowedPromotionModes.includes(requested)) {
    return {
      allowed: false,
      mode: null,
      reasonCodes: [...reasonCodes, "promotion_mode_not_allowed"],
      environment: null
    };
  }
  if (reasonCodes.includes("confidence_below_promotion_threshold") ||
      reasonCodes.includes("risk_above_maximum") ||
      reasonCodes.includes("data_quality_blocks_promotion")) {
    return { allowed: false, mode: null, reasonCodes, environment: null };
  }

  const mode: LearningPromotionMode =
    input.isSuperAdmin && requested === "SUPERADMIN_APPROVED"
      ? "SUPERADMIN_APPROVED"
      : requested === "ADMIN_APPROVED"
        ? "ADMIN_APPROVED"
        : requested === "OBSERVE_ONLY"
          ? "OBSERVE_ONLY"
          : "SHADOW";

  if (mode === "OBSERVE_ONLY") {
    return { allowed: true, mode, reasonCodes: ["observe_only"], environment: "SIMULATION" };
  }

  return {
    allowed: true,
    mode,
    reasonCodes: ["shadow_or_admin_test_only", "live_blocked"],
    environment: mode === "SHADOW" ? "SHADOW" : "ADMIN_TEST"
  };
}

export async function promoteLearningCandidate(input: {
  companyId: number;
  candidate: LearningCandidate;
  evaluation: LearningEvaluationReport;
  userId?: number | null;
  isSuperAdmin?: boolean;
  requestedMode?: LearningPromotionMode;
  memory?: CognitiveMemoryEngine;
}): Promise<{
  decision: PromotionDecision;
  artifact: LearningArtifact | null;
  guidance: {
    planner?: PlannerGuidance;
    runtime?: RuntimeLearningGuidance;
    strategy?: StrategyLearningGuidance;
  };
  knowledgeObject: KnowledgeObject | null;
}> {
  const decision = decideLearningPromotion({
    companyId: input.companyId,
    candidate: input.candidate,
    evaluation: input.evaluation,
    isSuperAdmin: input.isSuperAdmin,
    explicitApprove: true,
    requestedMode: input.requestedMode || "SHADOW"
  });

  if (!decision.allowed || !decision.mode || !decision.environment) {
    return { decision, artifact: null, guidance: {}, knowledgeObject: null };
  }

  const now = new Date().toISOString();
  const cfg = getLearningConfig(input.companyId);
  const artifact: LearningArtifact = {
    id: `lart_${createHash("sha256")
      .update(`${input.candidate.id}:${now}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId: input.companyId,
    agentId: input.candidate.agentId,
    candidateId: input.candidate.id,
    artifactType: input.candidate.candidateType,
    scope: input.candidate.scope,
    target: input.candidate.target,
    value: input.candidate.proposedChange,
    previousValue: input.candidate.currentState,
    status: "ACTIVE",
    effectiveFrom: now,
    effectiveUntil: new Date(
      Date.now() + cfg.artifactExpirationDays * 86400000
    ).toISOString(),
    version: 1,
    promotionMode: decision.mode,
    approvedBy: input.userId ?? null,
    promotedAt: now,
    rollbackAvailable: true,
    rollbackData: {
      previousValue: input.candidate.currentState,
      candidateId: input.candidate.id
    },
    environment: decision.environment,
    knowledgeObjectId: null,
    metadata: {
      liveIntegrationEnabled: false,
      productionPromotionEnabled: false,
      autoPromotionEnabled: false
    }
  };

  const guidance: {
    planner?: PlannerGuidance;
    runtime?: RuntimeLearningGuidance;
    strategy?: StrategyLearningGuidance;
  } = {};

  if (input.candidate.candidateType === "PLANNER_GUIDANCE") {
    guidance.planner = {
      scope: input.candidate.scope,
      goalType: null,
      recommendedPatterns: (input.candidate.proposedChange.recommendedPatterns as string[]) || [],
      avoidPatterns: (input.candidate.proposedChange.avoidPatterns as string[]) || [],
      recommendedPreconditions:
        (input.candidate.proposedChange.recommendedPreconditions as string[]) || [],
      recommendedPostconditions:
        (input.candidate.proposedChange.recommendedPostconditions as string[]) || [],
      warnings: ["planner_not_modified", "simulation_only"],
      confidence: input.candidate.confidence,
      sourceArtifactIds: [artifact.id]
    };
  }

  if (input.candidate.candidateType === "RUNTIME_PREFERENCE") {
    guidance.runtime = {
      capability: String(
        input.candidate.proposedChange.capability || input.candidate.target
      ),
      preferredRuntimeType: "TOOL_RUNTIME",
      preferredAdapter: "ToolRuntimeAdapter",
      preferredServerId: null,
      preferredTool: null,
      avoidRuntimeTypes:
        input.candidate.proposedChange.preference === "TOOL_RUNTIME_FIRST"
          ? ["MCP"]
          : [],
      avoidServers: [],
      avoidTools: [],
      confidence: input.candidate.confidence,
      sourceArtifactIds: [artifact.id]
    };
  }

  if (input.candidate.candidateType === "STRATEGY_PREFERENCE") {
    guidance.strategy = {
      capability: String(
        input.candidate.proposedChange.capability || input.candidate.target
      ),
      preferredStrategies:
        (input.candidate.proposedChange.preferredStrategies as string[]) || [],
      avoidStrategies: [],
      conditions: {},
      confidence: input.candidate.confidence,
      sourceArtifactIds: [artifact.id]
    };
  }

  let knowledgeObject: KnowledgeObject | null = null;
  const shouldKnowledge =
    input.candidate.candidateType === "PROCEDURAL_KNOWLEDGE" ||
    input.candidate.candidateType === "RECOVERY_RECOMMENDATION" ||
    input.candidate.candidateType === "KNOWLEDGE_GAP" ||
    input.candidate.candidateType === "ALERT_ONLY";

  if (shouldKnowledge && input.memory) {
    const memoryType =
      input.candidate.candidateType === "KNOWLEDGE_GAP" ||
      input.candidate.candidateType === "ALERT_ONLY"
        ? "REFLECTION"
        : "PROCEDURAL";
    const ko: KnowledgeObject = {
      id: `kobj_${createHash("sha256")
        .update(`${artifact.id}:ko`)
        .digest("hex")
        .slice(0, 12)}`,
      memoryType,
      tenantId: input.companyId,
      agentId: input.candidate.agentId,
      ticketId: null,
      contactId: null,
      goalId: null,
      executionId: null,
      title: input.candidate.title,
      summary: input.candidate.description,
      content: JSON.stringify({
        proposedChange: input.candidate.proposedChange,
        artifactId: artifact.id,
        environment: artifact.environment
      }),
      entities: [{ key: "target", value: input.candidate.target }],
      tags: ["learning", memoryType.toLowerCase(), input.candidate.candidateType],
      confidence: input.candidate.confidence,
      importance: Math.min(1, 0.4 + input.candidate.impact * 0.5),
      source: "learning_engine",
      version: 1,
      createdAt: now,
      updatedAt: now,
      metadata: {
        learningArtifactId: artifact.id,
        candidateId: input.candidate.id,
        live: false
      }
    };
    const saved = await input.memory.save(ko);
    knowledgeObject = saved.object;
    artifact.knowledgeObjectId = saved.object.id;
  }

  return { decision, artifact, guidance, knowledgeObject };
}

export default { decideLearningPromotion, promoteLearningCandidate };
