import fs from "fs";
import path from "path";
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

  await row.destroy();
  return { id: row.id, deleted: true };
}
