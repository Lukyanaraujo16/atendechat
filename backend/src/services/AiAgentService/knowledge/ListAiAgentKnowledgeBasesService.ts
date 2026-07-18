import { Op } from "sequelize";
import AppError from "../../../errors/AppError";
import AiAgent from "../../../models/AiAgent";
import AiAgentKnowledgeBase from "../../../models/AiAgentKnowledgeBase";
import AiKnowledgeBase from "../../../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";

export function serializeAgentKnowledgeBaseLink(
  link: AiAgentKnowledgeBase,
  extras?: {
    knowledgeBaseName?: string | null;
    indexedDocuments?: number;
    outdatedDocuments?: number;
  }
) {
  const base = link.knowledgeBase as AiKnowledgeBase | undefined;
  return {
    id: link.id,
    companyId: link.companyId,
    aiAgentId: link.aiAgentId,
    knowledgeBaseId: link.knowledgeBaseId,
    enabled: link.enabled,
    priority: link.priority,
    knowledgeBaseName:
      extras?.knowledgeBaseName ?? base?.name ?? null,
    knowledgeBaseEnabled: base?.enabled ?? null,
    indexedDocuments: extras?.indexedDocuments ?? null,
    outdatedDocuments: extras?.outdatedDocuments ?? null,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt
  };
}

export default async function ListAiAgentKnowledgeBasesService(input: {
  companyId: number;
  aiAgentId: number;
}) {
  const agent = await AiAgent.findOne({
    where: { id: input.aiAgentId, companyId: input.companyId }
  });
  if (!agent) {
    throw new AppError("ERR_NO_AI_AGENT_FOUND", 404, "Agente não encontrado.");
  }

  const links = await AiAgentKnowledgeBase.findAll({
    where: { companyId: input.companyId, aiAgentId: input.aiAgentId },
    include: [{ model: AiKnowledgeBase, required: false }],
    order: [
      ["priority", "ASC"],
      ["id", "ASC"]
    ]
  });

  const baseIds = links.map(l => l.knowledgeBaseId);
  const counts = new Map<number, { indexed: number; outdated: number }>();
  if (baseIds.length) {
    const docs = await AiKnowledgeDocument.findAll({
      where: {
        companyId: input.companyId,
        knowledgeBaseId: { [Op.in]: baseIds }
      },
      attributes: ["knowledgeBaseId", "indexStatus"]
    });
    for (const d of docs) {
      const cur = counts.get(d.knowledgeBaseId) || { indexed: 0, outdated: 0 };
      if (d.indexStatus === "completed") cur.indexed += 1;
      if (d.indexStatus === "outdated") cur.outdated += 1;
      counts.set(d.knowledgeBaseId, cur);
    }
  }

  const available = await AiKnowledgeBase.findAll({
    where: { companyId: input.companyId },
    attributes: ["id", "name", "enabled", "description"],
    order: [["name", "ASC"]]
  });

  return {
    links: links.map(l => {
      const c = counts.get(l.knowledgeBaseId);
      return serializeAgentKnowledgeBaseLink(l, {
        indexedDocuments: c?.indexed ?? 0,
        outdatedDocuments: c?.outdated ?? 0
      });
    }),
    availableBases: available.map(b => ({
      id: b.id,
      name: b.name,
      enabled: b.enabled,
      description: b.description
    }))
  };
}
