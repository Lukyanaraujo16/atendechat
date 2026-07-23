import { createHash } from "crypto";
import { RecoveryAction } from "../../../config/automationCognitivePlanningConstants";
import {
  ExecutionPlan,
  ExecutionStep,
  RecoveryPlan,
  StepValidation
} from "./types";

/**
 * Recovery Engine — gera Recovery Plan apenas.
 * NÃO executa automaticamente.
 */
export function suggestRecovery(input: {
  plan: ExecutionPlan;
  step: ExecutionStep;
  validation: StepValidation;
}): RecoveryPlan {
  const { plan, step, validation } = input;
  let action: RecoveryAction = "ABORT";
  let reason = validation.reason;
  const suggestedNextSteps: string[] = [];

  if (validation.result === "SKIPPED") {
    action = "SKIP";
    reason = "step_already_skipped";
    suggestedNextSteps.push("continue_next_ready_steps");
  } else if (validation.result === "PARTIAL") {
    if (step.requiresConfirmation || /confirm/i.test(validation.reason)) {
      action = "ASK_CONFIRMATION";
      reason = "confirmation_required";
      suggestedNextSteps.push("wait_user_confirmation", "then_resume_step");
    } else if (step.optional) {
      action = "SKIP";
      reason = "optional_partial";
      suggestedNextSteps.push("skip_and_continue");
    } else if (step.retryable) {
      action = "RETRY";
      reason = "partial_retryable";
      suggestedNextSteps.push("retry_same_step");
    } else {
      action = "REPLAN";
      reason = "partial_needs_replan";
      suggestedNextSteps.push("regenerate_plan_from_goal");
    }
  } else if (validation.result === "FAILED") {
    if (step.retryable) {
      action = "RETRY";
      reason = "failed_retryable";
      suggestedNextSteps.push("retry_same_step_once");
    } else if (step.optional) {
      action = "SKIP";
      reason = "failed_optional";
      suggestedNextSteps.push("skip_optional_step");
    } else if (plan.estimatedRisk === "critical" || plan.estimatedRisk === "high") {
      action = "ABORT";
      reason = "failed_high_risk";
      suggestedNextSteps.push("abort_and_escalate");
    } else {
      action = "REPLAN";
      reason = "failed_replan";
      suggestedNextSteps.push("replan_with_constraints");
    }
  } else {
    action = "SKIP";
    reason = "no_recovery_needed";
  }

  const id = createHash("sha256")
    .update(`${plan.id}:${step.id}:${action}:${Date.now()}`)
    .digest("hex")
    .slice(0, 16);

  return {
    id: `rec_${id}`,
    planId: plan.id,
    stepId: step.id,
    action,
    reason,
    suggestedNextSteps,
    createdAt: new Date().toISOString(),
    autoExecute: false
  };
}

export function buildRecoveryForValidations(input: {
  plan: ExecutionPlan;
  validations: StepValidation[];
}): RecoveryPlan[] {
  const byId = new Map(input.plan.steps.map(s => [s.id, s]));
  return input.validations
    .filter(v => v.result === "FAILED" || v.result === "PARTIAL")
    .map(v =>
      suggestRecovery({
        plan: input.plan,
        step: byId.get(v.stepId) || input.plan.steps[0],
        validation: v
      })
    );
}

export default { suggestRecovery, buildRecoveryForValidations };
