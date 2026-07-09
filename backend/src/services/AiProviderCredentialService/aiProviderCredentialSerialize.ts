import AppError from "../../errors/AppError";
import AiProviderCredential from "../../models/AiProviderCredential";

export type SerializedAiProviderCredential = {
  id: number;
  name: string;
  provider: string;
  enabled: boolean;
  isDefault: boolean;
  maskedKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeAiProviderCredential(
  row: AiProviderCredential
): SerializedAiProviderCredential {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    enabled: row.enabled,
    isDefault: row.isDefault,
    maskedKey: row.apiKeyMasked,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function findAiProviderCredentialOrThrow(
  companyId: number,
  id: number
): Promise<AiProviderCredential> {
  const row = await AiProviderCredential.findOne({
    where: { id, companyId }
  });
  if (!row) {
    throw new AppError(
      "ERR_AI_PROVIDER_CREDENTIAL_NOT_FOUND",
      404,
      "Credencial de IA não encontrada."
    );
  }
  return row;
}
