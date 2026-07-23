import {
  GoalRiskLevel,
  GoalType,
  PlanStatus,
  RecoveryAction,
  StepStatus,
  ValidationResult,
  ExecutionStepType,
  AUTOMATION_COGNITIVE_PLANNING_VERSION
} from "../../../config/automationCognitivePlanningConstants";
import type { PlanEvaluationReport } from "./evaluation/evaluationTypes";

export type GoalEntity = {
  key: string;
  value: string;
  confidence?: number;
};

export type Goal = {
  id: string;
  type: GoalType;
  objective: string;
  entities: GoalEntity[];
  constraints: string[];
  requestedOutcome: string;
  riskLevel: GoalRiskLevel;
  requiresConfirmation: boolean;
  metadata: Record<string, unknown>;
  sourceText?: string;
  detectedIntent?: string;
  confidence?: number;
  createdAt: string;
};

export type ExecutionStep = {
  id: string;
  type: ExecutionStepType;
  objective: string;
  expectedResult: string;
  requiredEntities: string[];
  dependsOn: string[];
  optional: boolean;
  retryable: boolean;
  requiresConfirmation: boolean;
  status: StepStatus;
};

export type ExecutionPlan = {
  id: string;
  goalId: string;
  version: string;
  steps: ExecutionStep[];
  dependencies: Array<{ from: string; to: string }>;
  preConditions: string[];
  postConditions: string[];
  estimatedComplexity: number;
  estimatedRisk: GoalRiskLevel;
  estimatedToolCalls: number;
  estimatedCost: number;
  estimatedLatency: number;
  status: PlanStatus;
  parallelGroups?: string[][];
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type StepValidation = {
  stepId: string;
  result: ValidationResult;
  reason: string;
  at: string;
};

export type RecoveryPlan = {
  id: string;
  planId: string;
  stepId: string;
  action: RecoveryAction;
  reason: string;
  suggestedNextSteps: string[];
  createdAt: string;
  /** Nunca executado automaticamente nesta fase */
  autoExecute: false;
};

export type PlanReplayRecord = {
  id: string;
  companyId: number;
  goal: Goal;
  plan: ExecutionPlan;
  dependencyOrder: string[];
  parallelGroups: string[][];
  validations: StepValidation[];
  recoveries: RecoveryPlan[];
  evaluation?: PlanEvaluationReport | null;
  createdAt: string;
};

export { AUTOMATION_COGNITIVE_PLANNING_VERSION };
