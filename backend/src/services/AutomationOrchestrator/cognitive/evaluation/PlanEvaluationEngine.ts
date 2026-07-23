import { createHash } from "crypto";
import { AUTOMATION_PLAN_EVALUATION_VERSION } from "../../../../config/automationPlanEvaluationConstants";
import { ExecutionPlan, Goal } from "../types";
import { getPlanEvaluationConfig } from "./PlanEvaluationConfig";
import { runAllValidators } from "./validators";
import {
  buildRecommendations,
  computePlanScore,
  decideApproval,
  toEvaluationRisk
} from "./QualityScore";
import { PlanEvaluationReport } from "./evaluationTypes";
import { recordPlanEvaluation } from "./PlanEvaluationMetrics";

/**
 * Plan Evaluation Engine — avalia plano ANTES de qualquer Executor.
 * Não executa Tools / Runtime / Providers.
 */
export function evaluatePlan(input: {
  plan: ExecutionPlan;
  goal: Goal;
  companyId?: number;
}): PlanEvaluationReport {
  const config = getPlanEvaluationConfig(input.companyId);
  const validatorResults = runAllValidators({
    plan: input.plan,
    goal: input.goal,
    config
  });
  const findings = validatorResults.flatMap(v => v.findings);
  const scoreBreakdown = computePlanScore({
    plan: input.plan,
    goal: input.goal,
    validatorResults,
    config
  });
  const approval = decideApproval({
    score: scoreBreakdown.composite,
    findings,
    plan: input.plan,
    goal: input.goal,
    config
  });
  const issues = findings.filter(
    f => f.severity === "ERROR" || f.severity === "CRITICAL"
  );
  const warnings = findings.filter(f => f.severity === "WARNING");
  const recommendations = buildRecommendations(findings);

  const byValidator: Record<string, (typeof validatorResults)[0]["result"]> = {};
  for (const v of validatorResults) {
    byValidator[v.validator] = v.result;
  }

  const id = createHash("sha256")
    .update(
      `${input.plan.id}:${input.goal.id}:${scoreBreakdown.composite}:${Date.now()}`
    )
    .digest("hex")
    .slice(0, 20);

  const report: PlanEvaluationReport = {
    id: `eval_${id}`,
    planId: input.plan.id,
    goalId: input.goal.id,
    approval,
    score: scoreBreakdown.composite,
    quality: scoreBreakdown.quality,
    risk: toEvaluationRisk(input.plan, input.goal),
    complexity: input.plan.estimatedComplexity,
    estimatedLatency: input.plan.estimatedLatency,
    estimatedCost: input.plan.estimatedCost,
    issues,
    warnings,
    recommendations,
    validationSummary: {
      total: validatorResults.length,
      passed: validatorResults.filter(v => v.result === "PASS").length,
      warnings: validatorResults.filter(v => v.result === "WARNING").length,
      failed: validatorResults.filter(v => v.result === "FAIL").length,
      byValidator
    },
    scoreBreakdown,
    validatorResults,
    generatedAt: new Date().toISOString(),
    metadata: {
      version: AUTOMATION_PLAN_EVALUATION_VERSION,
      executesPlan: false,
      executesTools: false,
      integratesLive: false,
      integratesShadow: false,
      configWeights: config.weights,
      configThresholds: config.thresholds
    },
    version: AUTOMATION_PLAN_EVALUATION_VERSION
  };

  if (input.companyId != null) {
    recordPlanEvaluation({
      companyId: input.companyId,
      report
    });
  }

  return report;
}

export default { evaluatePlan };
