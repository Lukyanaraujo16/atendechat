import AiAgent from "../../models/AiAgent";
import AiKnowledgeEmbeddingSettings from "../../models/AiKnowledgeEmbeddingSettings";
import AiProviderCredential from "../../models/AiProviderCredential";
import AppError from "../../errors/AppError";
import {
  findAiProviderCredentialOrThrow
} from "./aiProviderCredentialSerialize";

/** Credencial vinculada a um ou mais AiAgent (legado DELETE). */
export const ERR_AI_PROVIDER_CREDENTIAL_IN_USE =
  "ERR_AI_PROVIDER_CREDENTIAL_IN_USE";

/** Credencial referenciada por AiKnowledgeEmbeddingSettings (legado DELETE). */
export const ERR_AI_PROVIDER_CREDENTIAL_IN_USE_BY_KNOWLEDGE =
  "ERR_AI_PROVIDER_CREDENTIAL_IN_USE_BY_KNOWLEDGE";

/**
 * Exclui credencial do tenant autenticado.
 * Bloqueia se vinculada a AiAgent ou configurada em AiKnowledgeEmbeddingSettings.
 * Sem transaction: padrão do service legado e dos guards Product equivalentes;
 * a ordem find → agent → knowledge → destroy é determinística e auditável.
 */
export default async function DeleteAiProviderCredentialService(input: {
  companyId: number;
  id: number;
}) {
  await findAiProviderCredentialOrThrow(input.companyId, input.id);

  const linkedAgents = await AiAgent.count({
    where: {
      companyId: input.companyId,
      aiProviderCredentialId: input.id
    }
  });

  if (linkedAgents > 0) {
    throw new AppError(
      ERR_AI_PROVIDER_CREDENTIAL_IN_USE,
      400,
      "Não é possível excluir uma credencial vinculada a um ou mais agentes."
    );
  }

  const linkedKnowledge = await AiKnowledgeEmbeddingSettings.count({
    where: {
      companyId: input.companyId,
      credentialId: input.id
    }
  });

  if (linkedKnowledge > 0) {
    throw new AppError(
      ERR_AI_PROVIDER_CREDENTIAL_IN_USE_BY_KNOWLEDGE,
      400,
      "Não é possível excluir uma credencial em uso pela base de conhecimento."
    );
  }

  await AiProviderCredential.destroy({
    where: { id: input.id, companyId: input.companyId }
  });

  return { success: true };
}
