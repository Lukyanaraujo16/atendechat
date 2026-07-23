import {
  DEFAULT_AGENTOS_SCALABILITY_CONFIG,
  AgentOsScalabilityConfig,
  AgentOsProviderMode
} from "../../../config/automationAgentOsScalabilityConstants";
import { REDIS_URI_CONNECTION } from "../../../config/redis";

let cfg: AgentOsScalabilityConfig = { ...DEFAULT_AGENTOS_SCALABILITY_CONFIG };

export function getScalabilityConfig(): AgentOsScalabilityConfig {
  return cfg;
}

export function setScalabilityConfig(
  patch: Partial<AgentOsScalabilityConfig>
): AgentOsScalabilityConfig {
  cfg = { ...cfg, ...patch };
  return cfg;
}

export function resetScalabilityConfig(): AgentOsScalabilityConfig {
  cfg = { ...DEFAULT_AGENTOS_SCALABILITY_CONFIG };
  return cfg;
}

/** auto → redis se REDIS_URI presente e NODE_ENV !== test; senão memory. */
export function resolveProviderMode(mode: AgentOsProviderMode): "memory" | "redis" {
  if (mode === "memory") return "memory";
  if (mode === "redis") return "redis";
  if (process.env.NODE_ENV === "test") return "memory";
  if (REDIS_URI_CONNECTION && String(REDIS_URI_CONNECTION).trim()) return "redis";
  return "memory";
}

export function isRedisAvailableForAgentOs(): boolean {
  return Boolean(REDIS_URI_CONNECTION && String(REDIS_URI_CONNECTION).trim());
}
