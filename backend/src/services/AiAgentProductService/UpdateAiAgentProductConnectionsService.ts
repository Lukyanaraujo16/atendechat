import { Request } from "express";
import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import Whatsapp from "../../models/Whatsapp";
import { AiAgentProductConfigurationResult } from "../../types/aiAgentProduct";
import {
  resolveAiAgentProductAgentContextFromRows
} from "./ResolveAiAgentProductContextService";
import GetAiAgentProductSummaryService from "./GetAiAgentProductSummaryService";
import {
  assertAiAgentProductConfigurationAccess,
  assertConnectionsAssignableToAgent,
  isAiAgentProductActive,
  loadAiAgentProductConfigurationForAgent,
  lockEligibleAgents,
  parseConnectionRefs,
  rejectForbiddenConfigurationFields,
  resolveWhatsappsByRefs
} from "./aiAgentProductConfigurationHelpers";
import {
  serializeAiAgentProductConfigurationResult
} from "./serializeAiAgentProduct";
import { logger } from "../../utils/logger";

export default async function UpdateAiAgentProductConnectionsService(input: {
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

  if (!Object.prototype.hasOwnProperty.call(body, "connectionRefs")) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "connectionRefs é obrigatório."
    );
  }

  const desiredRefs = parseConnectionRefs(body.connectionRefs);

  const agentsPreview = await AiAgent.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    attributes: ["id", "enabled"]
  });
  const preResolved = resolveAiAgentProductAgentContextFromRows(agentsPreview);
  if (preResolved.resolution === "not_created") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      409,
      "Crie o Agente de IA antes de vincular conexões."
    );
  }
  if (preResolved.resolution === "ambiguous") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
      409,
      "Existem várias configurações de Agente de IA. Revise antes de continuar."
    );
  }

  // Validação prévia de ownership / already assigned (fora do lock)
  const desiredWhatsapps = await resolveWhatsappsByRefs({
    companyId,
    refs: desiredRefs
  });
  assertConnectionsAssignableToAgent(
    desiredWhatsapps,
    preResolved.agent!.id
  );

  let changed = false;
  let agentId = preResolved.agent!.id;

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
        "Crie o Agente de IA antes de vincular conexões."
      );
    }

    const agent = underLock.agent;
    agentId = agent.id;

    const currentLinked = await Whatsapp.findAll({
      where: { companyId, aiAgentId: agent.id },
      order: [["id", "ASC"]],
      lock: Transaction.LOCK.UPDATE,
      transaction
    });

    if (isAiAgentProductActive(agent, currentLinked)) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE",
        409,
        "Alterações de conexões não são permitidas com o Agente de IA ativo."
      );
    }

    const desired = await resolveWhatsappsByRefs({
      companyId,
      refs: desiredRefs,
      transaction
    });
    assertConnectionsAssignableToAgent(desired, agent.id);

    const currentIds = new Set(currentLinked.map(w => w.id));
    const desiredIds = new Set(desired.map(w => w.id));

    const toAdd = desired.filter(w => !currentIds.has(w.id));
    const toRemove = currentLinked.filter(w => !desiredIds.has(w.id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      changed = false;
      return;
    }

    for (const wa of toAdd) {
      await wa.update(
        {
          aiAgentId: agent.id,
          aiAgentEnabled: false,
          aiAgentMode: "disabled"
        },
        { transaction }
      );
    }
    for (const wa of toRemove) {
      await wa.update(
        {
          aiAgentId: null,
          aiAgentEnabled: false,
          aiAgentMode: "disabled"
        },
        { transaction }
      );
    }
    changed = true;
  });

  if (changed) {
    logger.info(
      {
        surface: "ai_agent_product",
        companyId,
        agentId,
        action: "connections_updated"
      },
      "ai_agent_product_connections_updated"
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
