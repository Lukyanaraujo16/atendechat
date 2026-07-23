import { ValidationResult } from "../../../config/automationCognitivePlanningConstants";
import { ExecutionStep, StepValidation } from "./types";

export type ValidateStepInput = {
  step: ExecutionStep;
  /**
   * Resultado simulado da etapa (planner não executa tools).
   * Se omitido, valida estrutura/precondições apenas.
   */
  simulatedOutcome?: {
    success?: boolean;
    partial?: boolean;
    skipped?: boolean;
    missingEntities?: string[];
    note?: string;
  };
};

/**
 * Validation Engine — avalia resultado de uma etapa (simulado nesta fase).
 */
export function validateStep(input: ValidateStepInput): StepValidation {
  const { step, simulatedOutcome } = input;
  const at = new Date().toISOString();

  if (simulatedOutcome?.skipped || step.status === "skipped") {
    return {
      stepId: step.id,
      result: "SKIPPED",
      reason: simulatedOutcome?.note || "step_skipped",
      at
    };
  }

  if (simulatedOutcome?.partial) {
    return {
      stepId: step.id,
      result: "PARTIAL",
      reason: simulatedOutcome.note || "partial_outcome",
      at
    };
  }

  if (simulatedOutcome?.success === false) {
    return {
      stepId: step.id,
      result: "FAILED",
      reason: simulatedOutcome.note || "step_failed",
      at
    };
  }

  const missing = (simulatedOutcome?.missingEntities || []).length
    ? simulatedOutcome!.missingEntities!
    : step.requiredEntities.filter(Boolean).length &&
        simulatedOutcome?.success === undefined
      ? []
      : [];

  if (missing.length) {
    return {
      stepId: step.id,
      result: "PARTIAL",
      reason: `missing_entities:${missing.join(",")}`,
      at
    };
  }

  if (step.requiresConfirmation && simulatedOutcome?.success !== true) {
    return {
      stepId: step.id,
      result: "PARTIAL",
      reason: "awaiting_confirmation",
      at
    };
  }

  return {
    stepId: step.id,
    result: "VALID",
    reason: simulatedOutcome?.note || "structure_ok",
    at
  };
}

export function validatePlanSteps(
  steps: ExecutionStep[],
  outcomes?: Record<string, ValidateStepInput["simulatedOutcome"]>
): StepValidation[] {
  return steps.map(step =>
    validateStep({
      step,
      simulatedOutcome: outcomes?.[step.id]
    })
  );
}

export function isValidationFailure(result: ValidationResult): boolean {
  return result === "FAILED" || result === "PARTIAL";
}

export default { validateStep, validatePlanSteps };
