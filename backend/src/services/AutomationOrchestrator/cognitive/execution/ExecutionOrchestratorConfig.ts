import {
  DEFAULT_EXECUTION_ORCHESTRATOR_CONFIG,
  ExecutionOrchestratorConfig
} from "../../../../config/automationExecutionOrchestratorConstants";

const byCompany = new Map<number, ExecutionOrchestratorConfig>();

function cloneDefault(): ExecutionOrchestratorConfig {
  return JSON.parse(JSON.stringify(DEFAULT_EXECUTION_ORCHESTRATOR_CONFIG));
}

export function getExecutionOrchestratorConfig(
  companyId?: number
): ExecutionOrchestratorConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function setExecutionOrchestratorConfig(
  companyId: number,
  partial: Partial<ExecutionOrchestratorConfig> | Record<string, unknown>
): ExecutionOrchestratorConfig {
  const current = getExecutionOrchestratorConfig(companyId);
  const p = partial as Partial<ExecutionOrchestratorConfig>;
  const merged: ExecutionOrchestratorConfig = {
    ...current,
    ...p
  };
  byCompany.set(companyId, merged);
  return merged;
}

export function __resetExecutionOrchestratorConfigForTests(): void {
  byCompany.clear();
}

export default {
  getExecutionOrchestratorConfig,
  setExecutionOrchestratorConfig
};
