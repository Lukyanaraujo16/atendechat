import AiAgent from "../../models/AiAgent";
import AiProviderCredential from "../../models/AiProviderCredential";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import {
  AI_PROVIDER_OPENAI,
  AiProviderId,
  isAiProviderId
} from "../../config/aiProviderModels";
import { decryptAiProviderApiKey } from "../../helpers/aiProviderCredentialCrypto";
import { logger } from "../../utils/logger";
import { resolveAiAgentOpenAiApiKey } from "./resolveAiAgentOpenAiApiKey";

export type AiCredentialResolutionSource =
  | "agent_credential"
  | "company_default"
  | "legacy_prompt"
  | "missing";

export type ResolvedAiApiCredential = {
  apiKey: string | null;
  provider: AiProviderId | null;
  source: AiCredentialResolutionSource;
  credentialId?: number;
};

type LoadedCredential = {
  apiKey: string;
  credentialId: number;
  provider: AiProviderId;
};

async function decryptCredentialKey(
  row: AiProviderCredential
): Promise<string | null> {
  if (!row.enabled) return null;
  try {
    const key = decryptAiProviderApiKey(row.apiKeyEncrypted).trim();
    return key || null;
  } catch {
    return null;
  }
}

async function loadAgentCredential(
  companyId: number,
  credentialId: number | null | undefined
): Promise<LoadedCredential | null> {
  if (credentialId == null) return null;
  const row = await AiProviderCredential.findOne({
    where: { id: credentialId, companyId, enabled: true }
  });
  if (!row) return null;
  const apiKey = await decryptCredentialKey(row);
  if (!apiKey) return null;
  return {
    apiKey,
    credentialId: row.id,
    provider: isAiProviderId(row.provider) ? row.provider : AI_PROVIDER_OPENAI
  };
}

async function loadCompanyDefaultCredential(
  companyId: number
): Promise<LoadedCredential | null> {
  const row = await AiProviderCredential.findOne({
    where: { companyId, enabled: true, isDefault: true },
    order: [["id", "ASC"]]
  });
  if (!row) return null;
  const apiKey = await decryptCredentialKey(row);
  if (!apiKey) return null;
  return {
    apiKey,
    credentialId: row.id,
    provider: isAiProviderId(row.provider) ? row.provider : AI_PROVIDER_OPENAI
  };
}

/**
 * Resolve credencial para o Agente de IA.
 * Ordem: credencial do agente → default da empresa → Prompt legado → ausente.
 */
export async function resolveAiAgentApiCredential(input: {
  companyId: number;
  agent: AiAgent;
  whatsapp: Whatsapp;
  ticket: Ticket;
}): Promise<ResolvedAiApiCredential> {
  const agentCred = await loadAgentCredential(
    input.companyId,
    input.agent.aiProviderCredentialId
  );
  if (agentCred) {
    return {
      apiKey: agentCred.apiKey,
      provider: agentCred.provider,
      source: "agent_credential",
      credentialId: agentCred.credentialId
    };
  }

  const defaultCred = await loadCompanyDefaultCredential(input.companyId);
  if (defaultCred) {
    return {
      apiKey: defaultCred.apiKey,
      provider: defaultCred.provider,
      source: "company_default",
      credentialId: defaultCred.credentialId
    };
  }

  const legacyKey = await resolveAiAgentOpenAiApiKey({
    companyId: input.companyId,
    whatsapp: input.whatsapp,
    ticket: input.ticket
  });
  if (legacyKey) {
    return {
      apiKey: legacyKey,
      provider: AI_PROVIDER_OPENAI,
      source: "legacy_prompt"
    };
  }

  return { apiKey: null, provider: null, source: "missing" };
}

export async function resolveAiAgentOpenAiApiKeyWithSource(
  input: Parameters<typeof resolveAiAgentApiCredential>[0]
): Promise<ResolvedAiApiCredential> {
  const resolved = await resolveAiAgentApiCredential(input);
  logger.info(
    {
      companyId: input.companyId,
      agentId: input.agent.id,
      credentialSource: resolved.source,
      credentialId: resolved.credentialId ?? null,
      provider: resolved.provider
    },
    "[AiAgent] credential_resolved"
  );
  return resolved;
}

/** @deprecated Use resolveAiAgentApiCredential — mantido para compatibilidade. */
export async function resolveAiAgentOpenAiApiKeyFromCredential(
  input: Parameters<typeof resolveAiAgentApiCredential>[0]
): Promise<string | null> {
  const resolved = await resolveAiAgentApiCredential(input);
  return resolved.apiKey;
}
