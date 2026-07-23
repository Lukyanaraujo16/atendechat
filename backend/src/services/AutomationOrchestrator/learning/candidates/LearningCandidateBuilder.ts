import { createHash } from "crypto";
import { getLearningConfig } from "../LearningConfig";
import { LearningCandidate, LearningDataset, LearningPattern } from "../types";
import { LearningCandidateType } from "../../../../config/automationLearningConstants";

function cid(seed: string): string {
  return `lcand_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

function mapPatternToCandidate(
  pattern: LearningPattern
): {
  type: LearningCandidateType;
  title: string;
  proposedChange: Record<string, unknown>;
  currentState: Record<string, unknown>;
  benefit: string;
  risks: string[];
  impact: number;
  risk: number;
} {
  switch (pattern.patternType) {
    case "RUNTIME_SELECTION_PATTERN":
    case "MCP_FAILURE_PATTERN":
    case "FALLBACK_PATTERN":
      return {
        type: "RUNTIME_PREFERENCE",
        title: `Prefer TOOL_RUNTIME_FIRST for ${pattern.subject}`,
        proposedChange: {
          preference: "TOOL_RUNTIME_FIRST",
          capability: pattern.conditions.capability || pattern.subject,
          environment: "SHADOW"
        },
        currentState: {
          runtimeType: pattern.conditions.runtimeType || "MCP",
          failureRate: pattern.failureRate
        },
        benefit: "Reduce runtime failures via preferred internal tool runtime in shadow",
        risks: ["May miss MCP-only capabilities", "Shadow-only — no live change"],
        impact: 0.55,
        risk: 0.35
      };
    case "SUCCESSFUL_STRATEGY":
      return {
        type: "STRATEGY_PREFERENCE",
        title: `Prefer strategy ${pattern.conditions.strategy}`,
        proposedChange: {
          preferredStrategies: [pattern.conditions.strategy],
          capability: pattern.conditions.capability,
          environment: "SHADOW"
        },
        currentState: { successRate: pattern.successRate },
        benefit: "Reuse successful strategy in simulation/shadow",
        risks: ["Overfitting to past sessions"],
        impact: 0.5,
        risk: 0.3
      };
    case "FREQUENT_RECOVERY":
      return {
        type: "RECOVERY_RECOMMENDATION",
        title: "Codify successful recovery path",
        proposedChange: { procedural: true, topic: "recovery" },
        currentState: { occurrences: pattern.occurrences },
        benefit: "Procedural knowledge for recoveries",
        risks: ["Stale recovery steps"],
        impact: 0.45,
        risk: 0.25
      };
    case "FREQUENT_REPLAN":
    case "INEFFICIENT_PLAN":
      return {
        type: "PLANNER_GUIDANCE",
        title: "Planner guidance to reduce replans",
        proposedChange: {
          avoidPatterns: ["REQUIRES_REPLAN_HEAVY"],
          recommendedPreconditions: ["validate_context"],
          environment: "SIMULATION"
        },
        currentState: { replanRelated: true },
        benefit: "Guidance artifact for future planner integration",
        risks: ["Planner not modified in this phase"],
        impact: 0.4,
        risk: 0.2
      };
    case "HUMAN_INTERVENTION_PATTERN":
    case "CONFIRMATION_PATTERN":
      return {
        type: "CONFIRMATION_RECOMMENDATION",
        title: "Tune confirmation policy (shadow)",
        proposedChange: { requireConfirmation: pattern.patternType !== "CONFIRMATION_PATTERN" },
        currentState: { interventions: pattern.occurrences },
        benefit: "Reduce unnecessary human friction",
        risks: ["May increase unsafe auto-steps if misapplied"],
        impact: 0.5,
        risk: 0.55
      };
    case "LATENCY_PATTERN":
      return {
        type: "TIMEOUT_RECOMMENDATION",
        title: "Adjust timeout recommendation",
        proposedChange: { suggestedTimeoutMs: Math.max(1000, Math.round((pattern.averageLatency || 5000) * 1.2)) },
        currentState: { averageLatency: pattern.averageLatency },
        benefit: "Fewer timeouts / better SLAs in tester",
        risks: ["Longer waits"],
        impact: 0.35,
        risk: 0.25
      };
    case "TOOL_FAILURE_PATTERN":
      return {
        type: "TOOL_CONFIGURATION_RECOMMENDATION",
        title: `Review tool ${pattern.subject}`,
        proposedChange: { toolId: pattern.subject, action: "review_config" },
        currentState: { failureRate: pattern.failureRate },
        benefit: "Alert operators to flaky tool",
        risks: ["No automatic disable"],
        impact: 0.4,
        risk: 0.3
      };
    case "POLICY_DENIAL_PATTERN":
      return {
        type: "POLICY_RECOMMENDATION",
        title: "Policy denial pattern alert",
        proposedChange: { observeOnly: true },
        currentState: { denials: pattern.occurrences },
        benefit: "Visibility — no real policy change",
        risks: ["Must not auto-change policies"],
        impact: 0.3,
        risk: 0.7
      };
    case "KNOWLEDGE_GAP":
      return {
        type: "KNOWLEDGE_GAP",
        title: "Fill knowledge gap",
        proposedChange: { createReflection: true },
        currentState: {},
        benefit: "Reflection KnowledgeObject",
        risks: ["Noise if gaps are transient"],
        impact: 0.4,
        risk: 0.25
      };
    case "INVALID_ARGUMENT_PATTERN":
      return {
        type: "PRECONDITION_RECOMMENDATION",
        title: "Strengthen argument preconditions",
        proposedChange: { validateArgs: true },
        currentState: {},
        benefit: "Fewer invalid argument failures",
        risks: ["Over-validation"],
        impact: 0.45,
        risk: 0.3
      };
    case "RECURRING_FAILURE":
      return {
        type: "ALERT_ONLY",
        title: `Recurring failure: ${pattern.subject}`,
        proposedChange: { alert: true, errorCode: pattern.conditions.errorCode },
        currentState: { failureRate: pattern.failureRate },
        benefit: "Operational visibility",
        risks: ["Alert fatigue"],
        impact: 0.5,
        risk: 0.2
      };
    default:
      return {
        type: "ALERT_ONLY",
        title: `Pattern ${pattern.patternType}`,
        proposedChange: { observe: true },
        currentState: {},
        benefit: "Observation",
        risks: ["Low"],
        impact: 0.2,
        risk: 0.15
      };
  }
}

/**
 * LearningCandidateBuilder — padrões → candidatos (propostas apenas).
 */
export function buildLearningCandidates(input: {
  companyId: number;
  agentId?: number | null;
  dataset: LearningDataset;
  patterns: LearningPattern[];
  createdBy?: number | null;
}): LearningCandidate[] {
  const cfg = getLearningConfig(input.companyId);
  const now = new Date().toISOString();
  const expires = new Date(
    Date.now() + cfg.candidateExpirationDays * 86400000
  ).toISOString();
  const out: LearningCandidate[] = [];

  for (const pattern of input.patterns.slice(0, cfg.maximumCandidatesPerAnalysis)) {
    const mapped = mapPatternToCandidate(pattern);
    if (!cfg.allowedCandidateTypes.includes(mapped.type)) continue;

    out.push({
      id: cid(`${input.companyId}:${pattern.id}:${mapped.type}`),
      companyId: input.companyId,
      agentId: input.agentId ?? null,
      candidateType: mapped.type,
      title: mapped.title,
      description: pattern.recommendationHint,
      scope: pattern.scope,
      target: pattern.subject,
      proposedChange: mapped.proposedChange,
      currentState: mapped.currentState,
      expectedBenefit: mapped.benefit,
      possibleRisks: mapped.risks,
      evidenceIds: pattern.evidenceIds,
      patternIds: [pattern.id],
      sampleSize: pattern.occurrences,
      confidence: pattern.confidence,
      impact: mapped.impact,
      risk: mapped.risk,
      reversibility: 0.9,
      dataQuality: input.dataset.dataQuality.level,
      status: "DRAFT",
      createdBy: input.createdBy ?? null,
      reviewedBy: null,
      reviewedAt: null,
      promotedAt: null,
      expiresAt: expires,
      version: 1,
      createdAt: now,
      updatedAt: now,
      metadata: {
        patternType: pattern.patternType,
        environmentOnly: ["SHADOW", "ADMIN_TEST", "SIMULATION"],
        appliesToLive: false,
        autoApply: false
      }
    });
  }

  return out;
}

export function candidateFingerprint(c: Pick<
  LearningCandidate,
  "companyId" | "agentId" | "candidateType" | "scope" | "target" | "proposedChange"
>): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        companyId: c.companyId,
        agentId: c.agentId,
        candidateType: c.candidateType,
        scope: c.scope,
        target: c.target,
        proposedChange: c.proposedChange
      })
    )
    .digest("hex")
    .slice(0, 16);
}

export default { buildLearningCandidates, candidateFingerprint };
