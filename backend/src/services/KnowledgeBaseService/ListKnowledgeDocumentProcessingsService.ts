import AiKnowledgeDocumentProcessing from "../../models/AiKnowledgeDocumentProcessing";
import { findKnowledgeDocumentOrThrow } from "./knowledgeBaseTenant";

export default async function ListKnowledgeDocumentProcessingsService(input: {
  companyId: number;
  knowledgeDocumentId: number;
}): Promise<{ processings: AiKnowledgeDocumentProcessing[]; count: number }> {
  await findKnowledgeDocumentOrThrow(
    input.companyId,
    input.knowledgeDocumentId
  );

  const processings = await AiKnowledgeDocumentProcessing.findAll({
    where: {
      companyId: input.companyId,
      knowledgeDocumentId: input.knowledgeDocumentId
    },
    order: [
      ["id", "DESC"]
    ]
  });

  return { processings, count: processings.length };
}
