import AppError from "../../errors/AppError";
import WhatsappEvolutionCredential from "../../models/WhatsappEvolutionCredential";
import { encryptEvolutionApiKey } from "../../helpers/evolutionCredentialCrypto";
import { maskSecret } from "../../helpers/maskSecret";

export type EvolutionCredentialInput = {
  companyId: number;
  whatsappId: number;
  baseUrl: string;
  instanceName: string;
  instanceId?: string | null;
  apiKey: string;
};

/**
 * Persiste credenciais Evolution cifradas.
 * Nunca grava API key em Whatsapps.token.
 */
export async function upsertWhatsappEvolutionCredentials(
  input: EvolutionCredentialInput
): Promise<WhatsappEvolutionCredential> {
  const baseUrl = String(input.baseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  const instanceName = String(input.instanceName || "").trim();
  const apiKey = String(input.apiKey || "").trim();
  const instanceId =
    input.instanceId != null && String(input.instanceId).trim() !== ""
      ? String(input.instanceId).trim()
      : null;

  if (!baseUrl) {
    throw new AppError(
      "ERR_EVOLUTION_BASE_URL_REQUIRED",
      400,
      "URL base Evolution é obrigatória."
    );
  }
  if (!instanceName) {
    throw new AppError(
      "ERR_EVOLUTION_INSTANCE_NAME_REQUIRED",
      400,
      "instanceName Evolution é obrigatório."
    );
  }
  if (!apiKey) {
    throw new AppError(
      "ERR_EVOLUTION_API_KEY_REQUIRED",
      400,
      "API key Evolution é obrigatória."
    );
  }

  const apiKeyEncrypted = encryptEvolutionApiKey(apiKey);
  const apiKeyMasked = maskSecret(apiKey);

  const existing = await WhatsappEvolutionCredential.unscoped().findOne({
    where: { whatsappId: input.whatsappId }
  });

  if (existing) {
    await existing.update({
      companyId: input.companyId,
      baseUrl,
      instanceName,
      instanceId,
      apiKeyEncrypted,
      apiKeyMasked
    });
    return existing;
  }

  return WhatsappEvolutionCredential.unscoped().create({
    companyId: input.companyId,
    whatsappId: input.whatsappId,
    baseUrl,
    instanceName,
    instanceId,
    apiKeyEncrypted,
    apiKeyMasked
  });
}

/** Serialização segura para API (sem ciphertext). */
export function serializeEvolutionCredentialPublic(
  row: WhatsappEvolutionCredential | null | undefined
): {
  id: number;
  whatsappId: number;
  baseUrl: string;
  instanceName: string;
  instanceId: string | null;
  apiKeyMasked: string;
} | null {
  if (!row) return null;
  return {
    id: row.id,
    whatsappId: row.whatsappId,
    baseUrl: row.baseUrl,
    instanceName: row.instanceName,
    instanceId: row.instanceId ?? null,
    apiKeyMasked: row.apiKeyMasked
  };
}
