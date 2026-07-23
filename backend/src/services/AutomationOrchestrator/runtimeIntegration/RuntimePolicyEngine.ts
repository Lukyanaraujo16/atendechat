import { getRuntimeIntegrationConfig } from "./RuntimeIntegrationConfig";
import { PolicyEvaluation, RuntimeExecutionRequest } from "./types";

/**
 * RuntimePolicyEngine — valida políticas antes da execução.
 * Nesta fase: somente valida; não bloqueia automaticamente.
 */
export function evaluateRuntimePolicies(input: {
  request: RuntimeExecutionRequest;
  companyId: number;
}): PolicyEvaluation {
  const config = getRuntimeIntegrationConfig(input.companyId);
  const warnings: string[] = [];
  const violations: string[] = [];

  if (input.request.timeout > config.timeouts.defaultMs) {
    warnings.push(
      `timeout_exceeds_default:${input.request.timeout}>${config.timeouts.defaultMs}`
    );
  }

  if (input.request.retryPolicy.maxAttempts > config.retry.maxAttempts) {
    warnings.push("retry_exceeds_policy");
  }

  if (input.request.confirmationPolicy.required &&
      !input.request.confirmationPolicy.confirmed) {
    warnings.push("confirmation_required_not_confirmed");
  }

  const estimatedTokens = Object.keys(input.request.parameters).length * 120;
  if (estimatedTokens > config.cost.tokenBudget) {
    warnings.push("token_budget_estimate_exceeded");
  }

  const costEstimate = config.cost.estimatePerRequestUsd;
  if (costEstimate > config.cost.costBudgetUsd) {
    warnings.push("cost_budget_estimate_exceeded");
  }

  if (input.request.constraints.includes("rate_limit_sensitive")) {
    warnings.push("rate_limit_sensitive_constraint");
  }

  if (input.request.constraints.includes("permission_strict")) {
    warnings.push("permission_strict_constraint");
  }

  // validateOnly — nunca bloqueia nesta fase
  const approved = config.policies.validateOnly
    ? true
    : violations.length === 0;

  return {
    approved,
    warnings,
    violations,
    costEstimate,
    timeout: input.request.timeout,
    retry: input.request.retryPolicy,
    metadata: {
      validateOnly: config.policies.validateOnly,
      enforceConfirmation: config.policies.enforceConfirmation,
      enforceRateLimit: config.policies.enforceRateLimit,
      enforcePermission: config.policies.enforcePermission
    }
  };
}

export default { evaluateRuntimePolicies };
