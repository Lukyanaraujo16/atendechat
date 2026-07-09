import AppError from "../../errors/AppError";
import AiProviderCredential from "../../models/AiProviderCredential";

export async function parseAiProviderCredentialId(
  companyId: number,
  value: unknown
): Promise<number | null> {
  if (value === null || value === "" || value === "null") {
    return null;
  }
  const id = Number(value);
  if (!Number.isFinite(id)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Credencial de IA inválida."
    );
  }
  const row = await AiProviderCredential.findOne({
    where: { id, companyId, enabled: true }
  });
  if (!row) {
    throw new AppError(
      "ERR_AI_PROVIDER_CREDENTIAL_NOT_FOUND",
      404,
      "Credencial de IA não encontrada ou inativa."
    );
  }
  return id;
}
