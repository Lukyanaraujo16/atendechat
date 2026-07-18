import { Op, Sequelize, WhereOptions } from "sequelize";
import AiKnowledgeBase from "../../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import { normalizeOptionalString } from "./knowledgeBaseTenant";

export default async function ListKnowledgeBasesService(input: {
  companyId: number;
  search?: unknown;
  enabled?: unknown;
}): Promise<{
  bases: Array<AiKnowledgeBase & { documentsCount?: number }>;
  count: number;
}> {
  const where: WhereOptions = { companyId: input.companyId };
  const search = normalizeOptionalString(input.search);
  if (search) {
    Object.assign(where, {
      [Op.or]: [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ]
    });
  }
  if (input.enabled === "true" || input.enabled === true) {
    Object.assign(where, { enabled: true });
  } else if (input.enabled === "false" || input.enabled === false) {
    Object.assign(where, { enabled: false });
  }

  const bases = await AiKnowledgeBase.findAll({
    where,
    order: [["name", "ASC"]]
  });

  const countMap = new Map<number, number>();
  if (bases.length > 0) {
    const counts = await AiKnowledgeDocument.findAll({
      attributes: [
        "knowledgeBaseId",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "documentsCount"]
      ],
      where: {
        companyId: input.companyId,
        knowledgeBaseId: bases.map((b) => b.id)
      },
      group: ["knowledgeBaseId"],
      raw: true
    });

    for (const row of counts as unknown as Array<{
      knowledgeBaseId: number;
      documentsCount: string | number;
    }>) {
      countMap.set(Number(row.knowledgeBaseId), Number(row.documentsCount) || 0);
    }
  }

  const withCounts = bases.map((b) => {
    const json = b.toJSON() as AiKnowledgeBase & { documentsCount?: number };
    json.documentsCount = countMap.get(b.id) || 0;
    return json;
  });

  return { bases: withCounts, count: withCounts.length };
}
