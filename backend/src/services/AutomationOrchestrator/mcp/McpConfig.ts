import {
  AutomationMcpConfig,
  DEFAULT_MCP_CONFIG
} from "../../../config/automationMcpConstants";

const byCompany = new Map<number, AutomationMcpConfig>();

function cloneDefault(): AutomationMcpConfig {
  return JSON.parse(JSON.stringify(DEFAULT_MCP_CONFIG));
}

export function getMcpConfig(companyId?: number): AutomationMcpConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function setMcpConfig(
  companyId: number,
  partial: Partial<AutomationMcpConfig> | Record<string, unknown>
): AutomationMcpConfig {
  const current = getMcpConfig(companyId);
  const p = partial as Partial<AutomationMcpConfig>;
  const merged: AutomationMcpConfig = {
    ...current,
    ...p,
    allowedTransports: p.allowedTransports || current.allowedTransports,
    blockedHosts: p.blockedHosts || current.blockedHosts,
    capabilityPreferences: {
      ...(current.capabilityPreferences || {}),
      ...(p.capabilityPreferences || {})
    },
    liveIntegrationEnabled: false,
    usesEmbeddings: false
  };
  byCompany.set(companyId, merged);
  return merged;
}

export function __resetMcpConfigForTests(): void {
  byCompany.clear();
}

export default { getMcpConfig, setMcpConfig };
