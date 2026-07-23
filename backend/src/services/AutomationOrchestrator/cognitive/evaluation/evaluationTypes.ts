import {
  EvaluationRiskLevel,
  FindingSeverity,
  PlanApprovalLevel,
  PlanEvaluationValidatorName,
  ValidatorResult,
  AUTOMATION_PLAN_EVALUATION_VERSION
} from "../../../../config/automationPlanEvaluationConstants";

export type ValidationFinding = {
  validator: PlanEvaluationValidatorName | string;
  severity: FindingSeverity;
  result: ValidatorResult;
  message: string;
  affectedSteps: string[];
  recommendation: string;
};

export type ValidatorRunResult = {
  validator: PlanEvaluationValidatorName;
  result: ValidatorResult;
  findings: ValidationFinding[];
};

export type PlanScoreBreakdown = {
  quality: number;
  risk: number;
  complexity: number;
  consistency: number;
  dependencyHealth: number;
  entityHealth: number;
  confirmationReadiness: number;
  composite: number;
};

export type PlanEvaluationReport = {
  id: string;
  planId: string;
  goalId: string;
  approval: PlanApprovalLevel;
  score: number;
  quality: number;
  risk: EvaluationRiskLevel;
  complexity: number;
  estimatedLatency: number;
  estimatedCost: number;
  issues: ValidationFinding[];
  warnings: ValidationFinding[];
  recommendations: string[];
  validationSummary: {
    total: number;
    passed: number;
    warnings: number;
    failed: number;
    byValidator: Record<string, ValidatorResult>;
  };
  scoreBreakdown: PlanScoreBreakdown;
  validatorResults: ValidatorRunResult[];
  generatedAt: string;
  metadata: Record<string, unknown>;
  version: string;
};

export type PlanDiffResult = {
  previousPlanId: string;
  nextPlanId: string;
  stepsAdded: string[];
  stepsRemoved: string[];
  riskChange: {
    from: string;
    to: string;
  };
  complexityChange: {
    from: number;
    to: number;
  };
  scoreChange: {
    from: number | null;
    to: number | null;
  };
  approvalChange: {
    from: PlanApprovalLevel | null;
    to: PlanApprovalLevel | null;
  };
};

export { AUTOMATION_PLAN_EVALUATION_VERSION };
