import {
  DEFAULT_EXECUTION_FEEDBACK_CONFIG,
  ExecutionFeedbackConfig
} from "../../../../config/automationExecutionFeedbackConstants";

const byCompany = new Map<number, ExecutionFeedbackConfig>();

function cloneDefault(): ExecutionFeedbackConfig {
  return JSON.parse(JSON.stringify(DEFAULT_EXECUTION_FEEDBACK_CONFIG));
}

export function getExecutionFeedbackConfig(
  companyId?: number
): ExecutionFeedbackConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function setExecutionFeedbackConfig(
  companyId: number,
  partial: Partial<ExecutionFeedbackConfig> | Record<string, unknown>
): ExecutionFeedbackConfig {
  const current = getExecutionFeedbackConfig(companyId);
  const p = partial as Partial<ExecutionFeedbackConfig>;
  const merged: ExecutionFeedbackConfig = {
    ...current,
    ...p,
    thresholds: { ...current.thresholds, ...(p.thresholds || {}) },
    recoveryRules: { ...current.recoveryRules, ...(p.recoveryRules || {}) },
    progressRules: { ...current.progressRules, ...(p.progressRules || {}) },
    confidence: { ...current.confidence, ...(p.confidence || {}) },
    executesTools: false,
    callsPlanner: false
  };
  byCompany.set(companyId, merged);
  return merged;
}

export function __resetExecutionFeedbackConfigForTests(): void {
  byCompany.clear();
}

export default { getExecutionFeedbackConfig, setExecutionFeedbackConfig };
