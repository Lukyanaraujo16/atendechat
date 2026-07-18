import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import { findKnowledgeBaseOrThrow } from "./knowledgeBaseTenant";

export default async function DeleteKnowledgeBaseService(input: {
  companyId: number;
  id: number;
}): Promise<{ id: number; deleted: true }> {
  const row = await findKnowledgeBaseOrThrow(input.companyId, input.id);

  const docsCount = await AiKnowledgeDocument.count({
    where: { companyId: input.companyId, knowledgeBaseId: row.id }
  });

  if (docsCount > 0) {
    throw new AppError(
      "ERR_KNOWLEDGE_BASE_HAS_DOCUMENTS",
      409,
      "Não é possível excluir uma base que contém documentos. Remova ou mova os documentos antes."
    );
  }

  await row.destroy();
  return { id: row.id, deleted: true };
}
