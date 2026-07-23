import {
  RuntimeIntegrationConfig,
  DEFAULT_RUNTIME_INTEGRATION_CONFIG
} from "../../../config/automationRuntimeIntegrationConstants";

const byCompany = new Map<number, RuntimeIntegrationConfig>();

function cloneDefault(): RuntimeIntegrationConfig {
  return JSON.parse(JSON.stringify(DEFAULT_RUNTIME_INTEGRATION_CONFIG));
}

export function getRuntimeIntegrationConfig(
  companyId?: number
): RuntimeIntegrationConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function setRuntimeIntegrationConfig(
  companyId: number,
  partial: Partial<RuntimeIntegrationConfig> | Record<string, unknown>
): RuntimeIntegrationConfig {
  const current = getRuntimeIntegrationConfig(companyId);
  const p = partial as Partial<RuntimeIntegrationConfig>;
  const merged: RuntimeIntegrationConfig = {
    ...current,
    ...p,
    timeouts: { ...current.timeouts, ...(p.timeouts || {}) },
    retry: { ...current.retry, ...(p.retry || {}) },
    cost: { ...current.cost, ...(p.cost || {}) },
    policies: { ...current.policies, ...(p.policies || {}) },
    dispatcher: { ...current.dispatcher, ...(p.dispatcher || {}) },
    adapters: { ...current.adapters, ...(p.adapters || {}) }
  };
  byCompany.set(companyId, merged);
  return merged;
}

export function __resetRuntimeIntegrationConfigForTests(): void {
  byCompany.clear();
}

export default { getRuntimeIntegrationConfig, setRuntimeIntegrationConfig };
