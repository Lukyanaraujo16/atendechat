import sequelize from "../../../database";
import AppError from "../../../errors/AppError";
import AiAgent from "../../../models/AiAgent";
import AiAgentKnowledgeBase from "../../../models/AiAgentKnowledgeBase";
import AiKnowledgeBase from "../../../models/AiKnowledgeBase";
import ListAiAgentKnowledgeBasesService from "./ListAiAgentKnowledgeBasesService";

type LinkInput = {
  knowledgeBaseId: number;
  enabled?: boolean;
  priority?: number;
};

/**
 * Substitui o conjunto de vínculos do agente (sync idempotente).
 */
export default async function SyncAiAgentKnowledgeBasesService(input: {
  companyId: number;
  aiAgentId: number;
  userId: number | null;
  links: LinkInput[];
}) {
  const agent = await AiAgent.findOne({
    where: { id: input.aiAgentId, companyId: input.companyId }
  });
  if (!agent) {
    throw new AppError("ERR_NO_AI_AGENT_FOUND", 404, "Agente não encontrado.");
  }

  const raw = Array.isArray(input.links) ? input.links : [];
  if (raw.length > 50) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Limite de 50 bases por agente."
    );
  }

  const normalized: LinkInput[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const knowledgeBaseId = Number(item.knowledgeBaseId);
    if (!Number.isFinite(knowledgeBaseId)) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "knowledgeBaseId inválido."
      );
    }
    if (seen.has(knowledgeBaseId)) continue;
    seen.add(knowledgeBaseId);
    normalized.push({
      knowledgeBaseId,
      enabled: item.enabled === undefined ? true : Boolean(item.enabled),
      priority: Math.min(
        10000,
        Math.max(1, Number(item.priority) || 100)
      )
    });
  }

  if (normalized.length) {
    const bases = await AiKnowledgeBase.findAll({
      where: {
        companyId: input.companyId,
        id: normalized.map(n => n.knowledgeBaseId)
      },
      attributes: ["id"]
    });
    if (bases.length !== normalized.length) {
      throw new AppError(
        "ERR_KNOWLEDGE_BASE_NOT_FOUND",
        404,
        "Uma ou mais bases não pertencem a esta empresa."
      );
    }
  }

  await sequelize.transaction(async transaction => {
    const existing = await AiAgentKnowledgeBase.findAll({
      where: { companyId: input.companyId, aiAgentId: input.aiAgentId },
      transaction
    });
    const existingByBase = new Map(
      existing.map(e => [e.knowledgeBaseId, e])
    );
    const keep = new Set(normalized.map(n => n.knowledgeBaseId));

    for (const row of existing) {
      if (!keep.has(row.knowledgeBaseId)) {
        await row.destroy({ transaction });
      }
    }

    for (const item of normalized) {
      const cur = existingByBase.get(item.knowledgeBaseId);
      if (cur) {
        await cur.update(
          {
            enabled: item.enabled !== false,
            priority: item.priority ?? 100,
            updatedBy: input.userId
          },
          { transaction }
        );
      } else {
        await AiAgentKnowledgeBase.create(
          {
            companyId: input.companyId,
            aiAgentId: input.aiAgentId,
            knowledgeBaseId: item.knowledgeBaseId,
            enabled: item.enabled !== false,
            priority: item.priority ?? 100,
            createdBy: input.userId,
            updatedBy: input.userId
          },
          { transaction }
        );
      }
    }
  });

  return ListAiAgentKnowledgeBasesService({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId
  });
}
