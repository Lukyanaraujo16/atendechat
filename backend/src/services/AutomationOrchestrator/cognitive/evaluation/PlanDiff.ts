import { PlanApprovalLevel } from "../../../../config/automationPlanEvaluationConstants";
import { ExecutionPlan } from "../types";
import { PlanDiffResult } from "./evaluationTypes";

/**
 * Plan Diff — compara plano anterior vs novo (replanejamento).
 */
export function diffPlans(input: {
  previous: ExecutionPlan;
  next: ExecutionPlan;
  previousScore?: number | null;
  nextScore?: number | null;
  previousApproval?: PlanApprovalLevel | null;
  nextApproval?: PlanApprovalLevel | null;
}): PlanDiffResult {
  const prevIds = new Set(input.previous.steps.map(s => s.id));
  const nextIds = new Set(input.next.steps.map(s => s.id));
  const stepsAdded = input.next.steps
    .filter(s => !prevIds.has(s.id))
    .map(s => s.id);
  const stepsRemoved = input.previous.steps
    .filter(s => !nextIds.has(s.id))
    .map(s => s.id);

  // também detectar por tipo+objetivo se ids mudaram no regenerate
  if (!stepsAdded.length && !stepsRemoved.length) {
    const prevKeys = new Set(
      input.previous.steps.map(s => `${s.type}:${s.objective}`)
    );
    const nextKeys = new Set(
      input.next.steps.map(s => `${s.type}:${s.objective}`)
    );
    for (const s of input.next.steps) {
      const k = `${s.type}:${s.objective}`;
      if (!prevKeys.has(k)) stepsAdded.push(s.id);
    }
    for (const s of input.previous.steps) {
      const k = `${s.type}:${s.objective}`;
      if (!nextKeys.has(k)) stepsRemoved.push(s.id);
    }
  }

  return {
    previousPlanId: input.previous.id,
    nextPlanId: input.next.id,
    stepsAdded,
    stepsRemoved,
    riskChange: {
      from: input.previous.estimatedRisk,
      to: input.next.estimatedRisk
    },
    complexityChange: {
      from: input.previous.estimatedComplexity,
      to: input.next.estimatedComplexity
    },
    scoreChange: {
      from: input.previousScore ?? null,
      to: input.nextScore ?? null
    },
    approvalChange: {
      from: input.previousApproval ?? null,
      to: input.nextApproval ?? null
    }
  };
}

export default { diffPlans };
