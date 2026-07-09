import AppError from "../../errors/AppError";
import { decryptAiProviderApiKey } from "../../helpers/aiProviderCredentialCrypto";
import { getAiProviderAdapter } from "../AiProviderService/AiProviderAdapterFactory";
import { findAiProviderCredentialOrThrow } from "./aiProviderCredentialSerialize";

export default async function TestAiProviderCredentialService(input: {
  companyId: number;
  id: number;
}) {
  const row = await findAiProviderCredentialOrThrow(input.companyId, input.id);

  if (!row.enabled) {
    throw new AppError(
      "ERR_AI_PROVIDER_CREDENTIAL_DISABLED",
      400,
      "Credencial desativada."
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptAiProviderApiKey(row.apiKeyEncrypted);
  } catch {
    throw new AppError(
      "ERR_AI_CREDENTIAL_DECRYPT_FAILED",
      500,
      "Não foi possível ler a credencial."
    );
  }

  try {
    const adapter = getAiProviderAdapter(row.provider);
    await adapter.testCredential(apiKey);
    return { ok: true, provider: row.provider };
  } catch {
    throw new AppError(
      "ERR_AI_PROVIDER_TEST_FAILED",
      400,
      "Falha ao validar a credencial com o provedor."
    );
  }
}
