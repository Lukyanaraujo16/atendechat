import AppError from "../../errors/AppError";
import { Request } from "express";
import SyncAiAgentKnowledgeBasesService from "../AiAgentService/knowledge/SyncAiAgentKnowledgeBasesService";
import {
  assertAiAgentProductConfigurationAccess,
  isAiAgentProductActive
} from "./aiAgentProductConfigurationHelpers";
import {
  encodeAgentRef,
  resolveAiAgentProductAgentForOperation
} from "./aiAgentProductAgentRef";
import ListAiAgentProductKnowledgeService from "./ListAiAgentProductKnowledgeService";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";

/**
 * Product — sincroniza vínculos de bases com o agente (Fase 2.10).
 */
export default async function SyncAiAgentProductKnowledgeService(input: {
  companyId: number;
  req?: Request;
  agentRef?: unknown;
  body?: Record<string, unknown>;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}) {
  const companyId = Number(input.companyId);
  const body = (input.body || {}) as Record<string, unknown>;
  const userId = input.req?.user?.id != null ? Number(input.req.user.id) : null;

  await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const resolved = await resolveAiAgentProductAgentForOperation({
    companyId,
    agentRef: input.agentRef
  });
  if (resolved.kind === "not_created") {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      409,
      "Crie o Agente de IA antes de gerenciar conhecimento."
    );
  }

  const linked = await Whatsapp.findAll({
    where: { companyId, aiAgentId: resolved.agentId },
    attributes: ["id", "aiAgentMode", "aiAgentEnabled"]
  });
  if (isAiAgentProductActive(resolved.agent, linked)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE",
      409,
      "Desative o Agente de IA antes de alterar as bases de conhecimento."
    );
  }

  const rawLinks = Array.isArray(body.knowledgeBaseRefs)
    ? body.knowledgeBaseRefs
    : Array.isArray(body.links)
      ? body.links
      : null;
  if (rawLinks == null) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "knowledgeBaseRefs é obrigatório."
    );
  }

  const links = rawLinks.map((item: unknown, index: number) => {
    if (typeof item === "string" || typeof item === "number") {
      return {
        knowledgeBaseId: Number(item),
        enabled: true,
        priority: (index + 1) * 100
      };
    }
    const row = (item || {}) as Record<string, unknown>;
    const ref = row.ref ?? row.knowledgeBaseId ?? row.knowledgeBaseRef;
    return {
      knowledgeBaseId: Number(ref),
      enabled: row.enabled === undefined ? true : Boolean(row.enabled),
      priority:
        row.priority != null ? Number(row.priority) : (index + 1) * 100
    };
  });

  await SyncAiAgentKnowledgeBasesService({
    companyId,
    aiAgentId: resolved.agentId,
    userId,
    links
  });

  logger.info(
    {
      surface: "ai_agent_product",
      companyId,
      agentId: resolved.agentId,
      action: "knowledge_synced",
      linkCount: links.length
    },
    "ai_agent_product_knowledge_synced"
  );

  const listed = await ListAiAgentProductKnowledgeService({
    companyId,
    req: input.req,
    agentRef: encodeAgentRef(resolved.agentId),
    availability: input.availability
  });

  return {
    changed: true,
    agentRef: encodeAgentRef(resolved.agentId),
    ...listed
  };
}
