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
 * Get por credentialRef. Missing / outro tenant → mesmo 404 comercial.
 */
export default async function GetAiAgentProductCredentialService(input: {
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
  return serializeAiAgentProductCredentialWithUsage(companyId, row);
}
