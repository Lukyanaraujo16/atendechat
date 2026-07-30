import { Request } from "express";
import {
  encryptAiProviderApiKey
} from "../../helpers/aiProviderCredentialCrypto";
import { maskSecret } from "../../helpers/maskSecret";
import { parseBooleanField } from "../AiAgentService/aiAgentTenant";
import {
  parseCredentialName,
  parseOptionalApiKey
} from "../AiProviderCredentialService/aiProviderCredentialValidation";
import { clearOtherDefaultCredentials } from "../AiProviderCredentialService/clearOtherDefaultCredentials";
import type { AiAgentProductCredential } from "../../types/aiAgentProduct";
import {
  assertAiAgentProductCredentialAccess,
  assertProductCredentialProvider,
  assertProviderChangeAllowed,
  findAiAgentProductCredentialOrThrow,
  parseCredentialRef,
  rejectForbiddenCredentialFields
} from "./aiAgentProductCredentialHelpers";
import {
  serializeAiAgentProductCredentialWithUsage
} from "./serializeAiAgentProductCredential";

/**
 * Atualiza credencial comercial. credentialRef permanece estável (mesmo id).
 *
 * apiKey: string vazia é tratada como ausência via parseOptionalApiKey
 * (não sobrescreve a chave existente).
 */
export default async function UpdateAiAgentProductCredentialService(input: {
  companyId: number;
  credentialRef: unknown;
  body?: Record<string, unknown>;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductCredential> {
  const companyId = Number(input.companyId);
  const body = (input.body || {}) as Record<string, unknown>;

  rejectForbiddenCredentialFields(body);
  await assertAiAgentProductCredentialAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const credentialId = parseCredentialRef(input.credentialRef);
  const row = await findAiAgentProductCredentialOrThrow(
    companyId,
    credentialId
  );

  const patch: Record<string, unknown> = {};
  let effectiveProvider = assertProductCredentialProvider(row.provider);

  if (Object.prototype.hasOwnProperty.call(body, "provider")) {
    const nextProvider = assertProductCredentialProvider(body.provider);
    await assertProviderChangeAllowed({
      companyId,
      credentialId: row.id,
      currentProvider: row.provider,
      nextProvider
    });
    effectiveProvider = nextProvider;
    patch.provider = nextProvider;
  }

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    patch.name = parseCredentialName(body.name);
  }

  if (Object.prototype.hasOwnProperty.call(body, "isDefault")) {
    const nextDefault = parseBooleanField(body.isDefault, row.isDefault);
    patch.isDefault = nextDefault;
    if (nextDefault) {
      // Mantém comportamento legado: limpa TODOS os defaults da company (não per-provider).
      await clearOtherDefaultCredentials(companyId, row.id);
    }
  }

  // Empty apiKey string → treated as absence (parseOptionalApiKey returns undefined).
  const nextApiKey = parseOptionalApiKey(body.apiKey, effectiveProvider);
  if (nextApiKey) {
    patch.apiKeyEncrypted = encryptAiProviderApiKey(nextApiKey);
    patch.apiKeyMasked = maskSecret(nextApiKey);
  }

  if (Object.keys(patch).length > 0) {
    await row.update(patch);
  }

  const reloaded = await row.reload();
  return serializeAiAgentProductCredentialWithUsage(companyId, reloaded);
}
