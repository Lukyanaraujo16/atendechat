import {
  DEFAULT_PLAN_EVALUATION_CONFIG,
  PlanEvaluationConfig
} from "../../../../config/automationPlanEvaluationConstants";

const byCompany = new Map<number, PlanEvaluationConfig>();

function cloneDefault(): PlanEvaluationConfig {
  return JSON.parse(JSON.stringify(DEFAULT_PLAN_EVALUATION_CONFIG));
}

function mergeConfig(
  base: PlanEvaluationConfig,
  partial: Partial<PlanEvaluationConfig> | Record<string, unknown>
): PlanEvaluationConfig {
  const p = partial as Partial<PlanEvaluationConfig>;
  return {
    weights: { ...base.weights, ...(p.weights || {}) },
    thresholds: { ...base.thresholds, ...(p.thresholds || {}) },
    riskScores: { ...base.riskScores, ...(p.riskScores || {}) },
    complexityPenaltyPerStep:
      p.complexityPenaltyPerStep ?? base.complexityPenaltyPerStep,
    complexityPenaltyPerDeepDep:
      p.complexityPenaltyPerDeepDep ?? base.complexityPenaltyPerDeepDep
  };
}

export function getPlanEvaluationConfig(
  companyId?: number
): PlanEvaluationConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function setPlanEvaluationConfig(
  companyId: number,
  partial: Partial<PlanEvaluationConfig> | Record<string, unknown>
): PlanEvaluationConfig {
  const current = getPlanEvaluationConfig(companyId);
  const merged = mergeConfig(current, partial);
  byCompany.set(companyId, merged);
  return merged;
}

export function __resetPlanEvaluationConfigForTests(): void {
  byCompany.clear();
}

export default { getPlanEvaluationConfig, setPlanEvaluationConfig };
