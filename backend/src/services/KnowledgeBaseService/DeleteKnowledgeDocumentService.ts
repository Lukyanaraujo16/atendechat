import fs from "fs";
import path from "path";
import AiKnowledgeDocumentChunk from "../../models/AiKnowledgeDocumentChunk";
import AiKnowledgeDocumentIndexing from "../../models/AiKnowledgeDocumentIndexing";
import { findKnowledgeDocumentOrThrow } from "./knowledgeBaseTenant";

export default async function DeleteKnowledgeDocumentService(input: {
  companyId: number;
  id: number;
}): Promise<{ id: number; deleted: true }> {
  const row = await findKnowledgeDocumentOrThrow(input.companyId, input.id);

  if (row.storagePath) {
    try {
      const absolute = path.isAbsolute(row.storagePath)
        ? row.storagePath
        : path.resolve(process.cwd(), row.storagePath);
      if (fs.existsSync(absolute)) {
        fs.unlinkSync(absolute);
      }
    } catch {
      /* arquivo ausente não bloqueia soft delete */
    }
  }

  // Impedir recuperação imediata dos chunks
  await AiKnowledgeDocumentChunk.update(
    { enabled: false },
    {
      where: {
        companyId: input.companyId,
        knowledgeDocumentId: row.id
      }
    }
  );
  await AiKnowledgeDocumentIndexing.update(
    { isActive: false },
    {
      where: {
        companyId: input.companyId,
        knowledgeDocumentId: row.id,
        isActive: true
      }
    }
  );
  await AiKnowledgeDocumentChunk.destroy({
    where: {
      companyId: input.companyId,
      knowledgeDocumentId: row.id
    }
  });

  await row.destroy();
  return { id: row.id, deleted: true };
}
