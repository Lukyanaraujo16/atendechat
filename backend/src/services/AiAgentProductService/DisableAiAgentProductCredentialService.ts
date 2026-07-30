import { Request } from "express";
import type { AiAgentProductCredential } from "../../types/aiAgentProduct";
import {
  assertAiAgentProductCredentialAccess,
  assertCredentialDisableAllowed,
  findAiAgentProductCredentialOrThrow,
  parseCredentialRef
} from "./aiAgentProductCredentialHelpers";
import {
  serializeAiAgentProductCredentialWithUsage
} from "./serializeAiAgentProductCredential";

/**
 * Desativa credencial com regras conservadoras (KB / WA shadow|live|dry_run).
 * Permite se só vinculada a agentes Off (todas as conexões Off), mesmo com AiAgent.enabled=true.
 */
export default async function DisableAiAgentProductCredentialService(input: {
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

  await assertCredentialDisableAllowed({
    companyId,
    credentialId: row.id
  });

  if (row.enabled !== false) {
    await row.update({ enabled: false });
  }

  const reloaded = await row.reload();
  return serializeAiAgentProductCredentialWithUsage(companyId, reloaded);
}
