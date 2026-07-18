import AiKnowledgeDocumentProcessing from "../../models/AiKnowledgeDocumentProcessing";
import {
  characterCountPreview,
  findKnowledgeDocumentOrThrow
} from "./knowledgeBaseTenant";

export default async function ShowKnowledgeDocumentService(input: {
  companyId: number;
  id: number;
}): Promise<Record<string, unknown>> {
  const doc = await findKnowledgeDocumentOrThrow(input.companyId, input.id);

  const lastProcessing = await AiKnowledgeDocumentProcessing.findOne({
    where: {
      companyId: input.companyId,
      knowledgeDocumentId: doc.id
    },
    order: [["id", "DESC"]]
  });

  return {
    ...doc.toJSON(),
    characterCount: characterCountPreview(doc),
    lastProcessing: lastProcessing ? lastProcessing.toJSON() : null
  };
}
