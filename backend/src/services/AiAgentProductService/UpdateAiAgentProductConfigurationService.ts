import { Request } from "express";
import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import AiAgentProfile from "../../models/AiAgentProfile";
import Whatsapp from "../../models/Whatsapp";
import { AiAgentProductConfigurationResult } from "../../types/aiAgentProduct";
import UpsertAiAgentProfileService from "../AiAgentService/UpsertAiAgentProfileService";
import {
  resolveAiAgentProductAgentContextFromRows
} from "./ResolveAiAgentProductContextService";
import GetAiAgentProductSummaryService from "./GetAiAgentProductSummaryService";
import {
  assertAiAgentProductConfigurationAccess,
  bodyHasAnyKey,
  buildAgentUpdatePatch,
  IDENTITY_FIELD_KEYS,
  isAiAgentProductActive,
  loadAiAgentProductConfigurationForAgent,
  lockEligibleAgents,
  MODEL_FIELD_KEYS,
  pickProfileFieldsFromBody,
  PROFILE_FIELD_KEYS,
  profileFieldsFromExisting,
  rejectForbiddenConfigurationFields,
  resolveCommercialProviderCredentialModel
} from "./aiAgentProductConfigurationHelpers";
import {
  serializeAiAgentProductConfigurationResult
} from "./serializeAiAgentProduct";
import { logger } from "../../utils/logger";

function hasStructuralFields(body: Record<string, unknown>): boolean {
  if (bodyHasAnyKey(body, MODEL_FIELD_KEYS)) return true;
  if (bodyHasAnyKey(body, PROFILE_FIELD_KEYS)) return true;
  if (Object.prototype.hasOwnProperty.call(body, "credentialRef")) return true;
  if (Object.prototype.hasOwnProperty.call(body, "connectionRefs")) return true;
  if (Object.prototype.hasOwnProperty.call(body, "provider")) return true;
  return false;
}

function hasOnlyIdentityOrEmpty(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body);
  if (keys.length === 0) return true;
  return keys.every(k =>
    (IDENTITY_FIELD_KEYS as readonly string[]).includes(k)
  );
}

export default async function UpdateAiAgentProductConfigurationService(input: {
  companyId: number;
  req?: Request;
  body?: Record<string, unknown>;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductConfigurationResult> {
  const companyId = Number(input.companyId);
  const body = (input.body || {}) as Record<string, unknown>;

  rejectForbiddenConfigurationFields(body);

  if (Object.prototype.hasOwnProperty.call(body, "connectionRefs")) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "Use o endpoint de conexões para alterar vínculos WhatsApp."
    );
  }

  const availability = await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const agentsPreview = await AiAgent.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    attributes: ["id", "enabled", "model", "aiProviderCredentialId"]
  });
  const preResolved = resolveAiAgentProductAgentContextFromRows(agentsPreview);
  if (preResolved.resolution === "not_created") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      409,
      "Crie o Agente de IA antes de atualizar a configuração."
    );
  }
  if (preResolved.resolution === "ambiguous") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
      409,
      "Existem várias configurações de Agente de IA. Revise antes de continuar."
    );
  }

  const previewAgent = preResolved.agent!;
  const resolved = await resolveCommercialProviderCredentialModel({
    companyId,
    body,
    current: {
      model: String(previewAgent.model || ""),
      aiProviderCredentialId: previewAgent.aiProviderCredentialId ?? null
    }
  });

  const hasProfile = bodyHasAnyKey(body, PROFILE_FIELD_KEYS);
  const hasCredentialRef = Object.prototype.hasOwnProperty.call(
    body,
    "credentialRef"
  );

  let changed = false;
  let agentId = previewAgent.id;

  await sequelize.transaction(async transaction => {
    const locked = await lockEligibleAgents(companyId, transaction);
    const underLock = resolveAiAgentProductAgentContextFromRows(locked);

    if (underLock.resolution === "ambiguous") {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
        409,
        "Existem várias configurações de Agente de IA. Revise antes de continuar."
      );
    }
    if (underLock.resolution === "not_created" || !underLock.agent) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        409,
        "Crie o Agente de IA antes de atualizar a configuração."
      );
    }

    const agent = underLock.agent;
    agentId = agent.id;

    const linked = await Whatsapp.findAll({
      where: { companyId, aiAgentId: agent.id },
      order: [["id", "ASC"]],
      lock: Transaction.LOCK.UPDATE,
      transaction
    });

    const active = isAiAgentProductActive(agent, linked);
    if (active && hasStructuralFields(body)) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE",
        409,
        "Alterações estruturais não são permitidas com o Agente de IA ativo."
      );
    }
    if (active && !hasOnlyIdentityOrEmpty(body)) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE",
        409,
        "Alterações estruturais não são permitidas com o Agente de IA ativo."
      );
    }

    const { patch, changed: agentChanged } = buildAgentUpdatePatch(body, agent, {
      model: resolved.model,
      skipModelFromBody: resolved.model !== undefined
    });
    if (agentChanged) {
      await agent.update(patch, { transaction });
      changed = true;
    }

    if (hasCredentialRef || resolved.credentialChanged) {
      const nextId =
        resolved.credentialId !== undefined ? resolved.credentialId : null;
      if (agent.aiProviderCredentialId !== nextId) {
        await agent.update(
          { aiProviderCredentialId: nextId },
          { transaction }
        );
        changed = true;
      }
    }
  });

  if (hasProfile) {
    const agent = await AiAgent.findOne({
      where: { id: agentId, companyId }
    });
    if (!agent) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        409,
        "Agente de IA não encontrado."
      );
    }
    const linked = await Whatsapp.findAll({
      where: { companyId, aiAgentId: agent.id },
      order: [["id", "ASC"]]
    });
    if (isAiAgentProductActive(agent, linked)) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE",
        409,
        "Alterações estruturais não são permitidas com o Agente de IA ativo."
      );
    }

    const existingProfile = await AiAgentProfile.findOne({
      where: { companyId, aiAgentId: agent.id }
    });
    const merged = {
      ...profileFieldsFromExisting(existingProfile),
      ...pickProfileFieldsFromBody(body)
    };
    await UpsertAiAgentProfileService({
      companyId,
      aiAgentId: agent.id,
      body: merged
    });
    changed = true;
  }

  if (changed) {
    logger.info(
      {
        surface: "ai_agent_product",
        companyId,
        agentId,
        action: "configuration_updated",
        provider: resolved.provider
      },
      "ai_agent_product_configuration_updated"
    );
  }

  const configuration = await loadAiAgentProductConfigurationForAgent({
    companyId,
    agentId
  });

  const summary = await GetAiAgentProductSummaryService({
    companyId,
    req: input.req,
    availability
  });

  return serializeAiAgentProductConfigurationResult({
    changed,
    configuration,
    summary
  });
}
