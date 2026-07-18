import AiKnowledgeBase from "../../models/AiKnowledgeBase";
import { findKnowledgeBaseOrThrow } from "./knowledgeBaseTenant";

/**
 * Duplica apenas a base (metadados). Documentos não são copiados —
 * use DuplicateKnowledgeDocumentService por documento.
 */
export default async function DuplicateKnowledgeBaseService(input: {
  companyId: number;
  id: number;
  userId: number | null;
}): Promise<AiKnowledgeBase> {
  const source = await findKnowledgeBaseOrThrow(input.companyId, input.id);
  const copyName = `${source.name} (cópia)`.slice(0, 160);

  return AiKnowledgeBase.create({
    companyId: input.companyId,
    name: copyName,
    description: source.description,
    enabled: false,
    createdBy: input.userId,
    updatedBy: input.userId
  });
}
