/**
 * Persistence helpers — engines never import Sequelize models directly.
 * Repositories are the only Sequelize boundary.
 */
import { getAgentOsPersistenceBackend } from "../../../config/automationAgentOsPersistenceConstants";
import {
  encryptAiProviderApiKey,
  decryptAiProviderApiKey
} from "../../../helpers/aiProviderCredentialCrypto";

export { getAgentOsPersistenceBackend };

/** Reusa AES-GCM existente — nunca duplicar. */
export function encryptAgentOsPayload(plain: string): string {
  return encryptAiProviderApiKey(plain);
}

export function decryptAgentOsPayload(stored: string): string {
  return decryptAiProviderApiKey(stored);
}

/** Fire-and-forget persist without changing sync store APIs. */
export function persistAsync(task: () => Promise<unknown>, label: string): void {
  if (getAgentOsPersistenceBackend() !== "sequelize") return;
  void Promise.resolve()
    .then(task)
    .catch(err => {
      // eslint-disable-next-line no-console
      console.error(`[AgentOS persistence:${label}]`, err?.message || err);
    });
}

export function assertCompanyId(companyId: number): number {
  const id = Number(companyId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("ERR_AGENTOS_TENANT_REQUIRED");
  }
  return id;
}
