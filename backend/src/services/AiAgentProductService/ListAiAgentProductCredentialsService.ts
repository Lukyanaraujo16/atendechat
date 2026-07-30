import { Request } from "express";
import AiProviderCredential from "../../models/AiProviderCredential";
import type { AiAgentProductCredential } from "../../types/aiAgentProduct";
import {
  assertAiAgentProductCredentialAccess
} from "./aiAgentProductCredentialHelpers";
import {
  serializeAiAgentProductCredentialWithUsage
} from "./serializeAiAgentProductCredential";

/**
 * Lista credenciais comerciais do tenant (enabled + disabled).
 * Ordem: isDefault DESC, name ASC, id ASC.
 */
export default async function ListAiAgentProductCredentialsService(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductCredential[]> {
  const companyId = Number(input.companyId);
  await assertAiAgentProductCredentialAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const rows = await AiProviderCredential.findAll({
    where: { companyId },
    order: [
      ["isDefault", "DESC"],
      ["name", "ASC"],
      ["id", "ASC"]
    ],
    attributes: [
      "id",
      "name",
      "provider",
      "apiKeyMasked",
      "enabled",
      "isDefault"
    ]
  });

  return Promise.all(
    rows.map(row => serializeAiAgentProductCredentialWithUsage(companyId, row))
  );
}
