import { Op } from "sequelize";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";

/**
 * Marca documentos indexados como outdated quando a config de embedding muda.
 * Não enfileira jobs automaticamente.
 */
export default async function MarkKnowledgeDocumentsIndexOutdatedByConfigService(input: {
  companyId: number;
}): Promise<number> {
  const [count] = await AiKnowledgeDocument.update(
    {
      indexStatus: "outdated",
      lastIndexingError: "Configuração de embedding/chunking alterada — reindexação necessária."
    },
    {
      where: {
        companyId: input.companyId,
        indexStatus: { [Op.in]: ["completed", "failed"] },
        processingStatus: "completed"
      }
    }
  );
  return count;
}
