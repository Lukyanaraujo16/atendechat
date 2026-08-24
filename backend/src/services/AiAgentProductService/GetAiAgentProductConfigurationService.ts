import { Request } from "express";
import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import AiAgentProfile from "../../models/AiAgentProfile";
import AiProviderCredential from "../../models/AiProviderCredential";
import Whatsapp from "../../models/Whatsapp";
import { AiAgentProductConfigurationView } from "../../types/aiAgentProduct";
import GetAiAgentProductSummaryService from "./GetAiAgentProductSummaryService";
import {
  assertAiAgentProductConfigurationAccess,
  buildAiAgentProductConfiguration
} from "./aiAgentProductConfigurationHelpers";
import {
  serializeAiAgentProductConfigurationView
} from "./serializeAiAgentProduct";
import {
  resolveAiAgentProductAgentForOperation,
  throwIfAiAgentArchived
} from "./aiAgentProductAgentRef";

export default async function GetAiAgentProductConfigurationService(input: {
  companyId: number;
  req?: Request;
  agentRef?: unknown;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductConfigurationView> {
  const companyId = Number(input.companyId);
  const availability = await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const resolved = await resolveAiAgentProductAgentForOperation({
    companyId,
    agentRef: input.agentRef
  });

  const summary = await GetAiAgentProductSummaryService({
    companyId,
    req: input.req,
    availability,
    agentRef: input.agentRef
  });

  if (resolved.kind === "not_created") {
    return serializeAiAgentProductConfigurationView({
      agentScope: { type: "none", count: 0 },
      configuration: null,
      summary
    });
  }

  const agentRow = await AiAgent.findOne({
    where: { id: resolved.agentId, companyId }
  });
  if (!agentRow) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND",
      404,
      "Agente de IA não encontrado."
    );
  }
  throwIfAiAgentArchived(agentRow);

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
    agentScope: { type: "single", count: 1 },
    agentRef: resolved.agentRef,
    configuration,
    editableWhileActive: agentRow.enabled === false,
    summary
  });
}
