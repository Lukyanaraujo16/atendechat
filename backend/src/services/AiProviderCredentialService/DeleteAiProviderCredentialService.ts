import AiAgent from "../../models/AiAgent";
import AiProviderCredential from "../../models/AiProviderCredential";
import AppError from "../../errors/AppError";
import {
  findAiProviderCredentialOrThrow
} from "./aiProviderCredentialSerialize";

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
      "ERR_AI_PROVIDER_CREDENTIAL_IN_USE",
      400,
      "Não é possível excluir uma credencial vinculada a um ou mais agentes."
    );
  }

  await AiProviderCredential.destroy({
    where: { id: input.id, companyId: input.companyId }
  });

  return { success: true };
}
