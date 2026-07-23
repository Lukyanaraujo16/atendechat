import { createHash } from "crypto";
import { analyzeGoal } from "./GoalAnalyzer";
import { planFromGoal } from "./CognitivePlanner";
import { buildDependencyGraph } from "./DependencyResolver";
import { validatePlanSteps } from "./ValidationEngine";
import { buildRecoveryForValidations } from "./RecoveryEngine";
import { PlanReplayRecord, StepValidation } from "./types";
import {
  recordPlanGenerated,
  recordValidationFailures,
  recordRecovery
} from "./CognitivePlanningMetrics";
import { evaluatePlan } from "./evaluation/PlanEvaluationEngine";

/**
 * Plan Replay — Goal → Plano → Evaluation → Validators → Issues/Warnings/Recommendations
 * (+ Validation de etapas + Recovery). Não executa Tools.
 */
export function replayCognitivePlan(input: {
  companyId: number;
  text: string;
  ticketId?: number;
  contactId?: number;
  simulatedOutcomes?: Record<
    string,
    {
      success?: boolean;
      partial?: boolean;
      skipped?: boolean;
      missingEntities?: string[];
      note?: string;
    }
  >;
  metadata?: Record<string, unknown>;
  includeEvaluation?: boolean;
}): PlanReplayRecord {
  const started = Date.now();
  const goal = analyzeGoal({
    text: input.text,
    companyId: input.companyId,
    ticketId: input.ticketId,
    contactId: input.contactId,
    metadata: input.metadata
  });
  const plan = planFromGoal(goal);
  const graph = buildDependencyGraph(plan.steps);
  const validations: StepValidation[] = validatePlanSteps(
    plan.steps,
    input.simulatedOutcomes
  );
  const recoveries = buildRecoveryForValidations({ plan, validations });

  const evaluation =
    input.includeEvaluation === false
      ? null
      : evaluatePlan({
          plan,
          goal,
          companyId: input.companyId
        });

  recordPlanGenerated({
    companyId: input.companyId,
    steps: plan.steps.length,
    complexity: plan.estimatedComplexity,
    risk: plan.estimatedRisk,
    latencyMs: Date.now() - started
  });
  const failures = validations.filter(
    v => v.result === "FAILED" || v.result === "PARTIAL"
  ).length;
  if (failures) {
    recordValidationFailures(input.companyId, failures);
  }
  if (recoveries.length) {
    recordRecovery(input.companyId, recoveries.length);
  }

  const id = createHash("sha256")
    .update(`${input.companyId}:${goal.id}:${plan.id}`)
    .digest("hex")
    .slice(0, 18);

  return {
    id: `replay_${id}`,
    companyId: input.companyId,
    goal,
    plan,
    dependencyOrder: graph.order,
    parallelGroups: graph.parallelGroups,
    validations,
    recoveries,
    evaluation,
    createdAt: new Date().toISOString()
  };
}

export default { replayCognitivePlan };
