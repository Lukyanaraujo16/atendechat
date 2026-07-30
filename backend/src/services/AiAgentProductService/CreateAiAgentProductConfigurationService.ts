import { Request } from "express";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import { AiAgentProductConfigurationResult } from "../../types/aiAgentProduct";
import UpsertAiAgentProfileService from "../AiAgentService/UpsertAiAgentProfileService";
import GetAiAgentProductSummaryService from "./GetAiAgentProductSummaryService";
import {
  assertAiAgentProductConfigurationAccess,
  assertConnectionsAssignableToAgent,
  buildAgentCreatePatch,
  bodyHasAnyKey,
  loadAiAgentProductConfigurationForAgent,
  parseConnectionRefs,
  pickProfileFieldsFromBody,
  PROFILE_FIELD_KEYS,
  rejectForbiddenConfigurationFields,
  resolveCommercialProviderCredentialModel,
  resolveWhatsappsByRefs
} from "./aiAgentProductConfigurationHelpers";
import {
  serializeAiAgentProductConfigurationResult
} from "./serializeAiAgentProduct";
import { encodeAgentRef } from "./aiAgentProductAgentRef";
import { logger } from "../../utils/logger";
import { Transaction } from "sequelize";

export default async function CreateAiAgentProductConfigurationService(input: {
  companyId: number;
  req?: Request;
  body?: Record<string, unknown>;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductConfigurationResult> {
  const companyId = Number(input.companyId);
  const body = (input.body || {}) as Record<string, unknown>;

  rejectForbiddenConfigurationFields(body);

  const availability = await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const resolved = await resolveCommercialProviderCredentialModel({
    companyId,
    body
  });

  const createPatch = buildAgentCreatePatch(body, {
    model: resolved.model
  });
  const hasProfile = bodyHasAnyKey(body, PROFILE_FIELD_KEYS);
  const hasCredentialRef = Object.prototype.hasOwnProperty.call(
    body,
    "credentialRef"
  );
  const hasConnectionRefs = Object.prototype.hasOwnProperty.call(
    body,
    "connectionRefs"
  );

  let connectionRefs: string[] = [];
  if (hasConnectionRefs) {
    connectionRefs = parseConnectionRefs(body.connectionRefs);
  }

  let createdAgentId = 0;

  await sequelize.transaction(async transaction => {
    // Lock determinístico da empresa — evita corridas; multiagente permitido.
    await AiAgent.findAll({
      where: { companyId },
      order: [["id", "ASC"]],
      lock: Transaction.LOCK.UPDATE,
      transaction
    });

    const agent = await AiAgent.create(
      {
        companyId,
        ...createPatch,
        ...(hasCredentialRef || resolved.credentialId !== undefined
          ? { aiProviderCredentialId: resolved.credentialId ?? null }
          : {})
      },
      { transaction }
    );

    createdAgentId = agent.id;

    if (hasConnectionRefs && connectionRefs.length > 0) {
      const whatsapps = await resolveWhatsappsByRefs({
        companyId,
        refs: connectionRefs,
        transaction
      });
      assertConnectionsAssignableToAgent(whatsapps, agent.id);
      for (const wa of whatsapps) {
        await wa.update(
          {
            aiAgentId: agent.id,
            aiAgentEnabled: false,
            aiAgentMode: "disabled"
          },
          { transaction }
        );
      }
    }
  });

  if (hasProfile) {
    await UpsertAiAgentProfileService({
      companyId,
      aiAgentId: createdAgentId,
      body: pickProfileFieldsFromBody(body)
    });
  }

  logger.info(
    {
      surface: "ai_agent_product",
      companyId,
      agentId: createdAgentId,
      action: "configuration_created",
      provider: resolved.provider
    },
    "ai_agent_product_configuration_created"
  );

  const configuration = await loadAiAgentProductConfigurationForAgent({
    companyId,
    agentId: createdAgentId
  });

  const summary = await GetAiAgentProductSummaryService({
    companyId,
    req: input.req,
    availability,
    agentRef: encodeAgentRef(createdAgentId)
  });

  return serializeAiAgentProductConfigurationResult({
    created: true,
    agentRef: encodeAgentRef(createdAgentId),
    configuration,
    summary
  });
}
