import AiAgent from "../../models/AiAgent";
import AiKnowledgeEmbeddingSettings from "../../models/AiKnowledgeEmbeddingSettings";
import AiProviderCredential from "../../models/AiProviderCredential";
import type { AiAgentProductCredential } from "../../types/aiAgentProduct";
import { encodeCredentialRef } from "./aiAgentProductCredentialHelpers";

export type AiAgentProductCredentialUsage = {
  aiAgent: boolean;
  knowledgeEmbedding: boolean;
};

/**
 * Conta uso comercial da credencial no tenant (sem IDs).
 */
export async function resolveAiAgentProductCredentialUsage(input: {
  companyId: number;
  credentialId: number;
}): Promise<AiAgentProductCredentialUsage> {
  const { companyId, credentialId } = input;

  const [agentCount, kbCount] = await Promise.all([
    AiAgent.count({
      where: { companyId, aiProviderCredentialId: credentialId }
    }),
    AiKnowledgeEmbeddingSettings.count({
      where: { companyId, credentialId }
    })
  ]);

  return {
    aiAgent: agentCount > 0,
    knowledgeEmbedding: kbCount > 0
  };
}

/**
 * Allow-list serializer — nunca faz spread do model; sem secrets/ids/companyId.
 */
export function serializeAiAgentProductCredential(
  row: Pick<
    AiProviderCredential,
    "id" | "name" | "provider" | "apiKeyMasked" | "enabled" | "isDefault"
  >,
  usage: AiAgentProductCredentialUsage
): AiAgentProductCredential {
  return {
    credentialRef: encodeCredentialRef(row.id),
    name: String(row.name || ""),
    provider: String(row.provider || ""),
    maskedKey: String(row.apiKeyMasked || ""),
    enabled: row.enabled === true,
    isDefault: row.isDefault === true,
    usage: {
      aiAgent: usage.aiAgent === true,
      knowledgeEmbedding: usage.knowledgeEmbedding === true
    }
  };
}

export async function serializeAiAgentProductCredentialWithUsage(
  companyId: number,
  row: Pick<
    AiProviderCredential,
    "id" | "name" | "provider" | "apiKeyMasked" | "enabled" | "isDefault"
  >
): Promise<AiAgentProductCredential> {
  const usage = await resolveAiAgentProductCredentialUsage({
    companyId,
    credentialId: row.id
  });
  return serializeAiAgentProductCredential(row, usage);
}
