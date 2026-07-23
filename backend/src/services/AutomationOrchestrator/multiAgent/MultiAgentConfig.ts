import {
  AutomationMultiAgentConfig,
  DEFAULT_MULTI_AGENT_CONFIG
} from "../../../config/automationMultiAgentConstants";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";

const byCompany = new Map<number, AutomationMultiAgentConfig>();

function cloneDefault(): AutomationMultiAgentConfig {
  return JSON.parse(JSON.stringify(DEFAULT_MULTI_AGENT_CONFIG));
}

export function getMultiAgentConfig(
  companyId?: number
): AutomationMultiAgentConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function setMultiAgentConfig(
  companyId: number,
  partial: Partial<AutomationMultiAgentConfig> | Record<string, unknown>
): AutomationMultiAgentConfig {
  const current = getMultiAgentConfig(companyId);
  const p = partial as Partial<AutomationMultiAgentConfig>;
  const merged: AutomationMultiAgentConfig = {
    ...current,
    ...p,
    selectionWeights: {
      ...current.selectionWeights,
      ...(p.selectionWeights || {})
    },
    healthThresholds: {
      ...current.healthThresholds,
      ...(p.healthThresholds || {})
    },
    failureThresholds: {
      ...current.failureThresholds,
      ...(p.failureThresholds || {})
    },
    allowedContextSharingLevels:
      p.allowedContextSharingLevels || current.allowedContextSharingLevels,
    defaultSelectionStrategies:
      p.defaultSelectionStrategies || current.defaultSelectionStrategies,
    liveIntegrationEnabled: false,
    coordinatorSimulationOnly: true,
    delegationSimulationOnly: true,
    handoffSimulationOnly: true,
    usesGenerativeAiForSelection: false,
    continuousAutonomyEnabled: false
  };
  byCompany.set(companyId, merged);
  observabilityRepository.putSettingFireAndForget(companyId, "multiAgent", merged as any);
  return merged;
}

export function __resetMultiAgentConfigForTests(): void {
  byCompany.clear();
}

export default { getMultiAgentConfig, setMultiAgentConfig };
