import { createHash } from "crypto";
import { getLearningConfig } from "../LearningConfig";
import {
  ExecutionHistorySample,
  LearningDataset,
  LearningPattern
} from "../types";
import {
  LearningPatternType,
  LearningSeverity
} from "../../../../config/automationLearningConstants";

function pid(seed: string): string {
  return `lpat_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

function severityFromRate(rate: number, high = 0.5): LearningSeverity {
  if (rate >= high + 0.25) return "CRITICAL";
  if (rate >= high) return "HIGH";
  if (rate >= high * 0.6) return "MEDIUM";
  if (rate >= high * 0.3) return "LOW";
  return "INFO";
}

function groupBy(
  samples: ExecutionHistorySample[],
  keyFn: (s: ExecutionHistorySample) => string | null | undefined
): Map<string, ExecutionHistorySample[]> {
  const map = new Map<string, ExecutionHistorySample[]>();
  for (const s of samples) {
    const key = keyFn(s);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

function rates(samples: ExecutionHistorySample[]) {
  const n = samples.length || 1;
  const success = samples.filter(s => s.status === "success").length;
  const failure = samples.filter(s => s.status === "failure").length;
  const latency = samples
    .map(s => s.latencyMs)
    .filter((v): v is number => typeof v === "number");
  const cost = samples
    .map(s => s.cost)
    .filter((v): v is number => typeof v === "number");
  return {
    successRate: success / n,
    failureRate: failure / n,
    averageLatency: latency.length
      ? latency.reduce((a, b) => a + b, 0) / latency.length
      : null,
    averageCost: cost.length ? cost.reduce((a, b) => a + b, 0) / cost.length : null
  };
}

/**
 * PatternDetectionEngine — regras determinísticas (sem IA generativa).
 */
export function detectLearningPatterns(input: {
  companyId: number;
  agentId?: number | null;
  dataset: LearningDataset;
  samples: ExecutionHistorySample[];
}): LearningPattern[] {
  const cfg = getLearningConfig(input.companyId);
  const th = cfg.patternThresholds;
  const now = new Date().toISOString();
  const patterns: LearningPattern[] = [];
  const evidenceIds = input.dataset.evidence.map(e => e.id);

  const push = (
    patternType: LearningPatternType,
    subject: string,
    samples: ExecutionHistorySample[],
    hint: string,
    conditions: Record<string, unknown> = {}
  ) => {
    const r = rates(samples);
    patterns.push({
      id: pid(`${input.companyId}:${patternType}:${subject}:${samples.length}`),
      companyId: input.companyId,
      agentId: input.agentId ?? null,
      patternType,
      scope: input.dataset.scopeType,
      subject,
      occurrences: samples.length,
      successRate: r.successRate,
      failureRate: r.failureRate,
      averageLatency: r.averageLatency,
      averageCost: r.averageCost,
      confidence: Math.min(0.95, 0.4 + samples.length * 0.05 + r.failureRate * 0.2),
      severity: severityFromRate(r.failureRate || samples.length / Math.max(input.samples.length, 1)),
      firstObservedAt: samples[0]?.timestamp || now,
      lastObservedAt: samples[samples.length - 1]?.timestamp || now,
      evidenceIds: evidenceIds.slice(0, 20),
      conditions,
      observations: [
        `${patternType} on ${subject} (n=${samples.length})`,
        `success=${(r.successRate * 100).toFixed(0)}% failure=${(r.failureRate * 100).toFixed(0)}%`
      ],
      recommendationHint: hint,
      metadata: { deterministic: true, usesGenerativeAi: false }
    });
  };

  // RECURRING_FAILURE by capability+error
  const failGroups = groupBy(
    input.samples.filter(s => s.status === "failure"),
    s => `${s.capability || "UNKNOWN"}::${s.errorCode || "UNKNOWN"}`
  );
  for (const [key, samples] of failGroups) {
    if (samples.length < th.recurringFailureMinOccurrences) continue;
    const rate = samples.length / Math.max(input.samples.length, 1);
    if (rate < th.recurringFailureRate && samples.length < th.recurringFailureMinOccurrences + 2)
      continue;
    push(
      "RECURRING_FAILURE",
      key,
      samples,
      "Investigate recurring failure and consider recovery/precondition guidance",
      { capability: key.split("::")[0], errorCode: key.split("::")[1] }
    );
  }

  // SUCCESSFUL_STRATEGY
  const strategyGroups = groupBy(
    input.samples.filter(s => s.strategy && s.status === "success"),
    s => `${s.capability || "UNKNOWN"}::${s.strategy}`
  );
  for (const [key, samples] of strategyGroups) {
    const allForCap = input.samples.filter(
      s => (s.capability || "UNKNOWN") === key.split("::")[0]
    );
    const rate = samples.length / Math.max(allForCap.length, 1);
    if (rate >= th.successfulStrategyRate && samples.length >= 2) {
      push(
        "SUCCESSFUL_STRATEGY",
        key,
        samples,
        `Prefer strategy ${key.split("::")[1]} for ${key.split("::")[0]}`,
        { capability: key.split("::")[0], strategy: key.split("::")[1] }
      );
    }
  }

  // FREQUENT_RECOVERY / REPLAN / HUMAN
  const recovery = input.samples.filter(s => s.recovery);
  if (recovery.length / Math.max(input.samples.length, 1) >= th.recoveryRate) {
    push("FREQUENT_RECOVERY", "recovery", recovery, "Document successful recovery paths as procedural knowledge");
  }
  const replans = input.samples.filter(s => s.replan);
  if (replans.length / Math.max(input.samples.length, 1) >= th.replanRate) {
    push("FREQUENT_REPLAN", "replan", replans, "Generate planner guidance to reduce replans");
  }
  const humans = input.samples.filter(s => s.humanIntervention);
  if (humans.length / Math.max(input.samples.length, 1) >= th.humanInterventionRate) {
    push("HUMAN_INTERVENTION_PATTERN", "human", humans, "Reduce human intervention via clearer confirmations/preconditions");
  }

  // RUNTIME_SELECTION_PATTERN
  const runtimeGroups = groupBy(input.samples, s => s.runtimeType);
  for (const [runtime, samples] of runtimeGroups) {
    const r = rates(samples);
    if (samples.length >= 3 && r.failureRate >= 0.4) {
      push(
        "RUNTIME_SELECTION_PATTERN",
        runtime,
        samples,
        `Consider preferring alternative runtime over ${runtime}`,
        { runtimeType: runtime, failureRate: r.failureRate }
      );
    }
  }

  // MCP_FAILURE_PATTERN
  const mcpFails = input.samples.filter(
    s => (s.runtimeType === "MCP" || s.mcpTool) && s.status === "failure"
  );
  if (mcpFails.length / Math.max(input.samples.length, 1) >= th.mcpFailureRate) {
    push("MCP_FAILURE_PATTERN", "mcp", mcpFails, "Prefer TOOL_RUNTIME or fix MCP config in shadow");
  }

  // TOOL_FAILURE_PATTERN
  const toolFails = groupBy(
    input.samples.filter(s => s.status === "failure" && s.toolId),
    s => s.toolId!
  );
  for (const [tool, samples] of toolFails) {
    if (samples.length >= th.recurringFailureMinOccurrences) {
      push("TOOL_FAILURE_PATTERN", tool, samples, `Review tool configuration for ${tool}`);
    }
  }

  // POLICY_DENIAL / FALLBACK / LATENCY / CONFIRMATION / INVALID_ARGUMENT / KNOWLEDGE_GAP
  const denials = input.samples.filter(s => s.policyDenied);
  if (denials.length / Math.max(input.samples.length, 1) >= th.policyDenialRate) {
    push("POLICY_DENIAL_PATTERN", "policy", denials, "Review policy denials — recommendation only");
  }
  const fallbacks = input.samples.filter(s => s.fallbackUsed);
  if (fallbacks.length / Math.max(input.samples.length, 1) >= th.fallbackRate) {
    push("FALLBACK_PATTERN", "fallback", fallbacks, "Adjust runtime preference to reduce fallbacks");
  }
  const slow = input.samples.filter(
    s => typeof s.latencyMs === "number" && s.latencyMs >= th.latencyMs
  );
  if (slow.length >= 2) {
    push("LATENCY_PATTERN", "latency", slow, "Recommend timeout/strategy adjustments");
  }
  const confirmAlways = input.samples.filter(s => s.confirmationApproved === true);
  if (confirmAlways.length >= 3) {
    push("CONFIRMATION_PATTERN", "confirmation", confirmAlways, "Low-risk confirmations may be simplified (shadow only)");
  }
  const invalidArgs = input.samples.filter(s => s.invalidArgument);
  if (invalidArgs.length >= 2) {
    push("INVALID_ARGUMENT_PATTERN", "args", invalidArgs, "Improve argument validation guidance");
  }
  const gaps = input.samples.filter(s => s.knowledgeGap);
  if (gaps.length >= 2) {
    push("KNOWLEDGE_GAP", "knowledge", gaps, "Create knowledge gap candidate");
  }
  const inefficient = input.samples.filter(
    s => s.planDecision === "REQUIRES_REPLAN" || s.replan
  );
  if (inefficient.length / Math.max(input.samples.length, 1) >= th.replanRate) {
    push("INEFFICIENT_PLAN", "plan", inefficient, "Provide planner guidance patterns");
  }
  const redundant = input.samples.filter(s => s.skippedStep);
  if (redundant.length >= 2) {
    push("REDUNDANT_STEP", "steps", redundant, "Recommend removing redundant steps");
  }

  return patterns.slice(0, 50);
}

export default { detectLearningPatterns };
