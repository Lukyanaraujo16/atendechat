import { Request } from "express";
import AiProviderCredential from "../../models/AiProviderCredential";
import CreateAiProviderCredentialService from "../AiProviderCredentialService/CreateAiProviderCredentialService";
import type { AiAgentProductCredential } from "../../types/aiAgentProduct";
import {
  assertAiAgentProductCredentialAccess,
  assertProductCredentialProvider,
  rejectForbiddenCredentialFields
} from "./aiAgentProductCredentialHelpers";
import {
  serializeAiAgentProductCredentialWithUsage
} from "./serializeAiAgentProductCredential";

/**
 * Cria credencial via CreateAiProviderCredentialService (encrypt/mask/default).
 * Não auto-vincula a agente. enabled fixo true no create Product.
 */
export default async function CreateAiAgentProductCredentialService(input: {
  companyId: number;
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

  const provider = assertProductCredentialProvider(body.provider);

  const created = await CreateAiProviderCredentialService({
    companyId,
    body: {
      name: body.name,
      provider,
      apiKey: body.apiKey,
      isDefault: body.isDefault,
      enabled: true
    }
  });

  const row = await AiProviderCredential.findOne({
    where: { id: created.id, companyId }
  });

  return serializeAiAgentProductCredentialWithUsage(
    companyId,
    row || {
      id: created.id,
      name: created.name,
      provider: created.provider,
      apiKeyMasked: created.maskedKey,
      enabled: created.enabled === true,
      isDefault: created.isDefault === true
    }
  );
}
