/**
 * AI Agent V2.1 — Plan Evaluation Engine.
 * Avalia qualidade do plano antes de qualquer Executor.
 * Não executa Tools / Runtime / Providers.
 */

export const AUTOMATION_PLAN_EVALUATION_VERSION = "2.1.0";

export const PLAN_APPROVAL_LEVELS = [
  "APPROVED",
  "APPROVED_WITH_WARNINGS",
  "REQUIRES_CONFIRMATION",
  "REQUIRES_REPLAN",
  "REJECTED"
] as const;

export type PlanApprovalLevel = (typeof PLAN_APPROVAL_LEVELS)[number];

export const VALIDATOR_RESULTS = ["PASS", "WARNING", "FAIL"] as const;
export type ValidatorResult = (typeof VALIDATOR_RESULTS)[number];

export const FINDING_SEVERITIES = [
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL"
] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const EVALUATION_RISK_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
] as const;
export type EvaluationRiskLevel = (typeof EVALUATION_RISK_LEVELS)[number];

export const PLAN_EVALUATION_VALIDATORS = [
  "DependencyValidator",
  "CircularDependencyValidator",
  "OrphanStepValidator",
  "PreconditionValidator",
  "PostconditionValidator",
  "EntityValidator",
  "ConfirmationValidator",
  "RiskValidator",
  "ComplexityValidator",
  "CostValidator",
  "LatencyValidator",
  "RedundancyValidator",
  "ImpossiblePlanValidator",
  "PlannerConsistencyValidator"
] as const;

export type PlanEvaluationValidatorName =
  (typeof PLAN_EVALUATION_VALIDATORS)[number];

/** Defaults configuráveis — sem hardcode nos engines. */
export const DEFAULT_PLAN_EVALUATION_CONFIG = {
  weights: {
    quality: 0.25,
    risk: 0.2,
    complexity: 0.1,
    consistency: 0.15,
    dependencyHealth: 0.15,
    entityHealth: 0.1,
    confirmationReadiness: 0.05
  },
  thresholds: {
    approvedMinScore: 80,
    approvedWithWarningsMinScore: 65,
    requiresConfirmationMinScore: 50,
    requiresReplanMinScore: 35,
    maxComplexity: 8,
    maxCost: 0.05,
    maxLatencyMs: 2000,
    maxCriticalFindings: 0,
    maxErrorFindings: 2
  },
  riskScores: {
    low: 100,
    medium: 70,
    high: 40,
    critical: 10
  },
  complexityPenaltyPerStep: 4,
  complexityPenaltyPerDeepDep: 6
} as const;

export type PlanEvaluationConfig = {
  weights: {
    quality: number;
    risk: number;
    complexity: number;
    consistency: number;
    dependencyHealth: number;
    entityHealth: number;
    confirmationReadiness: number;
  };
  thresholds: {
    approvedMinScore: number;
    approvedWithWarningsMinScore: number;
    requiresConfirmationMinScore: number;
    requiresReplanMinScore: number;
    maxComplexity: number;
    maxCost: number;
    maxLatencyMs: number;
    maxCriticalFindings: number;
    maxErrorFindings: number;
  };
  riskScores: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  complexityPenaltyPerStep: number;
  complexityPenaltyPerDeepDep: number;
};

export const PLAN_EVALUATION_SETTING_KEY = "automationPlanEvaluation";
