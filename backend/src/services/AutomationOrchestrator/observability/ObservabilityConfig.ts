import {
  DEFAULT_AGENTOS_OBSERVABILITY_CONFIG,
  AgentOsObservabilityConfig
} from "../../../config/automationAgentOsObservabilityConstants";

let cfg: AgentOsObservabilityConfig = { ...DEFAULT_AGENTOS_OBSERVABILITY_CONFIG };

export function getObservabilityConfig(): AgentOsObservabilityConfig {
  return cfg;
}

export function setObservabilityConfig(
  patch: Partial<AgentOsObservabilityConfig>
): AgentOsObservabilityConfig {
  cfg = { ...cfg, ...patch };
  return cfg;
}

export function resetObservabilityConfig(): AgentOsObservabilityConfig {
  cfg = { ...DEFAULT_AGENTOS_OBSERVABILITY_CONFIG };
  return cfg;
}
