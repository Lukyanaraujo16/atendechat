import { Request } from "express";
import AiAgent from "../../models/AiAgent";
import AiAgentProfile from "../../models/AiAgentProfile";
import AiProviderCredential from "../../models/AiProviderCredential";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { AiAgentProductConfigurationView } from "../../types/aiAgentProduct";
import {
  resolveAiAgentProductAgentContext
} from "./ResolveAiAgentProductContextService";
import GetAiAgentProductSummaryService from "./GetAiAgentProductSummaryService";
import {
  assertAiAgentProductConfigurationAccess,
  buildAiAgentProductConfiguration
} from "./aiAgentProductConfigurationHelpers";
import {
  serializeAiAgentProductConfigurationView
} from "./serializeAiAgentProduct";

export default async function GetAiAgentProductConfigurationService(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductConfigurationView> {
  const companyId = Number(input.companyId);
  const availability = await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const agents = await AiAgent.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    attributes: ["id", "name", "enabled"]
  });

  const resolved = resolveAiAgentProductAgentContext(
    agents.map(a => ({
      id: a.id,
      name: a.name,
      enabled: a.enabled === true,
      hasProvider: false,
      hasInstructions: false,
      explicitlyPaused: false
    }))
  );

  const summary = await GetAiAgentProductSummaryService({
    companyId,
    req: input.req,
    availability
  });

  if (resolved.resolution === "not_created") {
    return serializeAiAgentProductConfigurationView({
      agentScope: resolved.agentScope,
      configuration: null,
      summary
    });
  }

  if (resolved.resolution === "ambiguous") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
      409,
      "Existem várias configurações de Agente de IA. Revise antes de continuar."
    );
  }

  const agentRow = await AiAgent.findOne({
    where: { id: resolved.agent!.id, companyId }
  });
  if (!agentRow) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      409,
      "Agente de IA não encontrado."
    );
  }

  const profile = await AiAgentProfile.findOne({
    where: { companyId, aiAgentId: agentRow.id }
  });

  const linkedWhatsapps = await Whatsapp.findAll({
    where: { companyId, aiAgentId: agentRow.id },
    order: [["id", "ASC"]]
  });

  const credential =
    agentRow.aiProviderCredentialId != null
      ? await AiProviderCredential.findOne({
          where: {
            id: agentRow.aiProviderCredentialId,
            companyId
          }
        })
      : null;

  const configuration = buildAiAgentProductConfiguration({
    agent: agentRow,
    profile,
    credential,
    linkedWhatsapps
  });

  return serializeAiAgentProductConfigurationView({
    agentScope: resolved.agentScope,
    configuration,
    editableWhileActive: agentRow.enabled === false,
    summary
  });
}
