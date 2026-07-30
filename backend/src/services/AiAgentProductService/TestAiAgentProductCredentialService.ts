import { Request } from "express";
import AppError from "../../errors/AppError";
import TestAiProviderCredentialService from "../AiProviderCredentialService/TestAiProviderCredentialService";
import type { AiAgentProductCredentialTestResult } from "../../types/aiAgentProduct";
import {
  assertAiAgentProductCredentialAccess,
  findAiAgentProductCredentialOrThrow,
  parseCredentialRef
} from "./aiAgentProductCredentialHelpers";

/**
 * Testa a credencial via TestAiProviderCredentialService.
 * Resposta comercial sanitizada — sem payload bruto do provedor.
 */
export default async function TestAiAgentProductCredentialService(input: {
  companyId: number;
  credentialRef: unknown;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductCredentialTestResult> {
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

  try {
    const result = await TestAiProviderCredentialService({
      companyId,
      id: row.id
    });
    return {
      success: result.ok === true,
      provider: String(result.provider || row.provider),
      message: "Credencial validada com sucesso."
    };
  } catch (err) {
    if (err instanceof AppError) {
      if (err.message === "ERR_AI_PROVIDER_CREDENTIAL_NOT_FOUND") {
        throw new AppError(
          "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
          404,
          "Credencial não encontrada."
        );
      }
      if (err.message === "ERR_AI_PROVIDER_CREDENTIAL_DISABLED") {
        throw new AppError(
          "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
          400,
          "Credencial desativada."
        );
      }
      if (err.message === "ERR_AI_PROVIDER_TEST_FAILED") {
        throw new AppError(
          "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
          400,
          "Não foi possível validar a credencial com o provedor."
        );
      }
      if (err.message === "ERR_AI_CREDENTIAL_DECRYPT_FAILED") {
        throw new AppError(
          "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
          500,
          "Não foi possível validar a credencial."
        );
      }
      throw err;
    }
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      400,
      "Não foi possível validar a credencial com o provedor."
    );
  }
}
