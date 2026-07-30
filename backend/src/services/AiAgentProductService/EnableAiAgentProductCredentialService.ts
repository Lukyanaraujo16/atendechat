import { Request } from "express";
import type { AiAgentProductCredential } from "../../types/aiAgentProduct";
import {
  assertAiAgentProductCredentialAccess,
  findAiAgentProductCredentialOrThrow,
  parseCredentialRef
} from "./aiAgentProductCredentialHelpers";
import {
  serializeAiAgentProductCredentialWithUsage
} from "./serializeAiAgentProductCredential";

/**
 * Habilita credencial (enabled=true). Sem outros side effects.
 */
export default async function EnableAiAgentProductCredentialService(input: {
  companyId: number;
  credentialRef: unknown;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductCredential> {
  const companyId = Number(input.companyId);
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

  if (row.enabled !== true) {
    await row.update({ enabled: true });
  }

  const reloaded = await row.reload();
  return serializeAiAgentProductCredentialWithUsage(companyId, reloaded);
}
