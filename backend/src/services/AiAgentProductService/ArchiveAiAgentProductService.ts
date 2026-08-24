import { Request } from "express";
import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import { isAiAgentArchived } from "../../helpers/isAiAgentArchived";
import AiAgent from "../../models/AiAgent";
import Whatsapp from "../../models/Whatsapp";
import {
  ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND,
  encodeAgentRef,
  parseRequiredAgentRef
} from "./aiAgentProductAgentRef";
import { resolveAiAgentProductAvailability } from "./GetAiAgentProductSummaryService";

export const ERR_AI_AGENT_PRODUCT_ARCHIVE_REQUIRES_DEACTIVATION =
  "ERR_AI_AGENT_PRODUCT_ARCHIVE_REQUIRES_DEACTIVATION";
export const ERR_AI_AGENT_PRODUCT_ALREADY_ARCHIVED =
  "ERR_AI_AGENT_PRODUCT_ALREADY_ARCHIVED";

function rejectClientEntityIds(body: Record<string, unknown> | undefined): void {
  if (!body || typeof body !== "object") return;
  if (
    body.companyId != null ||
    body.agentId != null ||
    body.whatsappId != null ||
    body.aiAgentId != null
  ) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      403,
      "Contexto da empresa inválido."
    );
  }
}

async function lockLinkedWhatsapps(
  companyId: number,
  agentId: number,
  transaction: Transaction
): Promise<Whatsapp[]> {
  return Whatsapp.findAll({
    where: { companyId, aiAgentId: agentId },
    order: [["id", "ASC"]],
    lock: Transaction.LOCK.UPDATE,
    transaction
  });
}

/**
 * Arquiva o agente (soft archive). Não chama destroy. Não apaga histórico,
 * knowledge bases, credenciais nem AgentOS.
 */
export default async function ArchiveAiAgentProductService(input: {
  companyId: number;
  req: Request;
  agentRef?: unknown;
  body?: Record<string, unknown>;
}): Promise<{ archived: true; agentRef: string; archivedAt: string }> {
  if (input.companyId == null || !Number.isFinite(Number(input.companyId))) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      403,
      "Contexto da empresa inválido."
    );
  }

  rejectClientEntityIds(input.body);
  const companyId = Number(input.companyId);
  const agentId = parseRequiredAgentRef(input.agentRef);

  const availability = await resolveAiAgentProductAvailability({
    companyId,
    req: input.req
  });

  if (!availability.enabledByPlan) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      403,
      "O Agente de IA não está disponível no plano."
    );
  }
  if (!availability.accessibleByUser) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
      403,
      "Acesso ao Agente de IA não permitido para este usuário."
    );
  }

  let archivedAtIso = "";

  await sequelize.transaction(async transaction => {
    const agent = await AiAgent.findOne({
      where: { id: agentId, companyId },
      lock: Transaction.LOCK.UPDATE,
      transaction
    });

    if (!agent) {
      throw new AppError(
        ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND,
        404,
        "Agente de IA não encontrado."
      );
    }

    if (isAiAgentArchived(agent)) {
      throw new AppError(
        ERR_AI_AGENT_PRODUCT_ALREADY_ARCHIVED,
        409,
        "Este agente já foi arquivado."
      );
    }

    if (agent.enabled === true) {
      throw new AppError(
        ERR_AI_AGENT_PRODUCT_ARCHIVE_REQUIRES_DEACTIVATION,
        409,
        "Desative o agente antes de arquivá-lo."
      );
    }

    const linked = await lockLinkedWhatsapps(companyId, agent.id, transaction);
    for (const wa of linked) {
      await wa.update(
        {
          aiAgentId: null,
          aiAgentEnabled: false,
          aiAgentMode: "disabled"
        },
        { transaction }
      );
    }

    const archivedAt = new Date();
    await agent.update({ archivedAt }, { transaction });
    archivedAtIso = archivedAt.toISOString();
  });

  return {
    archived: true,
    agentRef: encodeAgentRef(agentId),
    archivedAt: archivedAtIso
  };
}
