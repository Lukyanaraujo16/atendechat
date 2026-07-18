import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import {
  characterCountPreview,
  findKnowledgeBaseOrThrow
} from "./knowledgeBaseTenant";

export default async function ShowKnowledgeBaseService(input: {
  companyId: number;
  id: number;
}): Promise<Record<string, unknown>> {
  const base = await findKnowledgeBaseOrThrow(input.companyId, input.id);
  const documents = await AiKnowledgeDocument.findAll({
    where: { companyId: input.companyId, knowledgeBaseId: base.id },
    order: [["updatedAt", "DESC"]]
  });

  return {
    ...base.toJSON(),
    documentsCount: documents.length,
    documents: documents.map((d) => ({
      ...d.toJSON(),
      characterCount: characterCountPreview(d)
    }))
  };
}
