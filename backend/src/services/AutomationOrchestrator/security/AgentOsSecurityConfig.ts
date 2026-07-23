import {
  DEFAULT_AGENTOS_SECURITY_CONFIG,
  AgentOsSecurityConfig
} from "../../../config/automationAgentOsSecurityConstants";

let runtimeConfig: AgentOsSecurityConfig = {
  ...DEFAULT_AGENTOS_SECURITY_CONFIG
};

export function getAgentOsSecurityConfig(): AgentOsSecurityConfig {
  return runtimeConfig;
}

export function setAgentOsSecurityConfig(
  patch: Partial<AgentOsSecurityConfig>
): AgentOsSecurityConfig {
  runtimeConfig = { ...runtimeConfig, ...patch };
  return runtimeConfig;
}

export function resetAgentOsSecurityConfig(): AgentOsSecurityConfig {
  runtimeConfig = { ...DEFAULT_AGENTOS_SECURITY_CONFIG };
  return runtimeConfig;
}
