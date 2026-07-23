import {
  EvaluationRiskLevel,
  PlanApprovalLevel,
  PlanEvaluationConfig
} from "../../../../config/automationPlanEvaluationConstants";
import { ExecutionPlan, Goal } from "../types";
import {
  PlanScoreBreakdown,
  ValidationFinding,
  ValidatorRunResult
} from "./evaluationTypes";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function riskKey(plan: ExecutionPlan, goal: Goal): keyof PlanEvaluationConfig["riskScores"] {
  const r = (plan.estimatedRisk || goal.riskLevel || "low").toLowerCase();
  if (r === "medium" || r === "high" || r === "critical") return r;
  return "low";
}

export function toEvaluationRisk(
  plan: ExecutionPlan,
  goal: Goal
): EvaluationRiskLevel {
  return riskKey(plan, goal).toUpperCase() as EvaluationRiskLevel;
}

export function computePlanScore(input: {
  plan: ExecutionPlan;
  goal: Goal;
  validatorResults: ValidatorRunResult[];
  config: PlanEvaluationConfig;
}): PlanScoreBreakdown {
  const { plan, goal, validatorResults, config } = input;
  const w = config.weights;
  const findings = validatorResults.flatMap(v => v.findings);

  const failCount = findings.filter(f => f.result === "FAIL").length;
  const warnCount = findings.filter(f => f.result === "WARNING").length;
  const quality = clamp(100 - failCount * 18 - warnCount * 6);

  const risk = clamp(config.riskScores[riskKey(plan, goal)]);

  const deepDeps = plan.steps.filter(s => (s.dependsOn || []).length > 1).length;
  const complexityRaw =
    100 -
    plan.steps.length * config.complexityPenaltyPerStep -
    deepDeps * config.complexityPenaltyPerDeepDep;
  const complexity = clamp(complexityRaw);

  const consistencyValidator = validatorResults.find(
    v => v.validator === "PlannerConsistencyValidator"
  );
  const consistency = clamp(
    consistencyValidator?.result === "FAIL"
      ? 30
      : consistencyValidator?.result === "WARNING"
        ? 70
        : 100
  );

  const depFail =
    validatorResults.find(v => v.validator === "DependencyValidator")
      ?.result === "FAIL" ||
    validatorResults.find(v => v.validator === "CircularDependencyValidator")
      ?.result === "FAIL";
  const dependencyHealth = clamp(
    depFail
      ? 20
      : validatorResults.find(v => v.validator === "DependencyValidator")
          ?.result === "WARNING"
        ? 70
        : 100
  );

  const entity = validatorResults.find(v => v.validator === "EntityValidator");
  const entityHealth = clamp(
    entity?.result === "FAIL" ? 40 : entity?.result === "WARNING" ? 75 : 100
  );

  const conf = validatorResults.find(
    v => v.validator === "ConfirmationValidator"
  );
  const confirmationReadiness = clamp(
    conf?.result === "FAIL" ? 25 : conf?.result === "WARNING" ? 70 : 100
  );

  const composite = clamp(
    quality * w.quality +
      risk * w.risk +
      complexity * w.complexity +
      consistency * w.consistency +
      dependencyHealth * w.dependencyHealth +
      entityHealth * w.entityHealth +
      confirmationReadiness * w.confirmationReadiness
  );

  return {
    quality,
    risk,
    complexity,
    consistency,
    dependencyHealth,
    entityHealth,
    confirmationReadiness,
    composite
  };
}

export function decideApproval(input: {
  score: number;
  findings: ValidationFinding[];
  plan: ExecutionPlan;
  goal: Goal;
  config: PlanEvaluationConfig;
}): PlanApprovalLevel {
  const { score, findings, plan, goal, config } = input;
  const t = config.thresholds;
  const criticals = findings.filter(f => f.severity === "CRITICAL").length;
  const errors = findings.filter(f => f.severity === "ERROR").length;
  const warnings = findings.filter(f => f.severity === "WARNING").length;

  if (criticals > t.maxCriticalFindings || score < t.requiresReplanMinScore) {
    return criticals > t.maxCriticalFindings || score < t.requiresReplanMinScore / 2
      ? "REJECTED"
      : "REQUIRES_REPLAN";
  }
  if (errors > t.maxErrorFindings) {
    return "REQUIRES_REPLAN";
  }
  if (
    goal.requiresConfirmation ||
    plan.steps.some(s => s.requiresConfirmation && s.type !== "confirm")
  ) {
    if (score >= t.requiresConfirmationMinScore && errors > 0) {
      return "REQUIRES_CONFIRMATION";
    }
    if (
      findings.some(
        f =>
          f.validator === "ConfirmationValidator" && f.result === "FAIL"
      )
    ) {
      return "REQUIRES_CONFIRMATION";
    }
  }
  if (score >= t.approvedMinScore && warnings === 0 && errors === 0) {
    return "APPROVED";
  }
  if (score >= t.approvedWithWarningsMinScore && errors === 0) {
    return "APPROVED_WITH_WARNINGS";
  }
  if (score >= t.requiresConfirmationMinScore) {
    return goal.requiresConfirmation
      ? "REQUIRES_CONFIRMATION"
      : "REQUIRES_REPLAN";
  }
  if (score >= t.requiresReplanMinScore) {
    return "REQUIRES_REPLAN";
  }
  return "REJECTED";
}

export function buildRecommendations(
  findings: ValidationFinding[]
): string[] {
  const recs = findings
    .map(f => f.recommendation)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
  return recs.slice(0, 20);
}

export default { computePlanScore, decideApproval, buildRecommendations };
