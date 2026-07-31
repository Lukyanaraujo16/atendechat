import AppError from "../../errors/AppError";
import { Request } from "express";
import ListAiAgentKnowledgeBasesService from "../AiAgentService/knowledge/ListAiAgentKnowledgeBasesService";
import {
  assertAiAgentProductConfigurationAccess
} from "./aiAgentProductConfigurationHelpers";
import {
  encodeAgentRef,
  resolveAiAgentProductAgentForOperation
} from "./aiAgentProductAgentRef";

/**
 * Product — listagem de bases vinculadas ao agente (Fase 2.10).
 * Reutiliza Sync/List seguros; não reabre rotas legadas.
 */
export default async function ListAiAgentProductKnowledgeService(input: {
  companyId: number;
  req?: Request;
  agentRef?: unknown;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}) {
  const companyId = Number(input.companyId);
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

  const data = await ListAiAgentKnowledgeBasesService({
    companyId,
    aiAgentId: resolved.agentId
  });

  return {
    agentRef: encodeAgentRef(resolved.agentId),
    links: (data.links || []).map(link => ({
      ref: String(link.knowledgeBaseId),
      name: link.knowledgeBaseName || "—",
      enabled: link.enabled === true,
      priority: link.priority,
      indexedDocuments: link.indexedDocuments,
      outdatedDocuments: link.outdatedDocuments,
      knowledgeBaseEnabled: link.knowledgeBaseEnabled
    })),
    availableBases: (data.availableBases || []).map(base => ({
      ref: String(base.id),
      name: base.name,
      enabled: base.enabled === true,
      description: base.description != null ? String(base.description) : null
    }))
  };
}
