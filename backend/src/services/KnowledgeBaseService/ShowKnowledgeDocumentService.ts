import AiKnowledgeDocumentProcessing from "../../models/AiKnowledgeDocumentProcessing";
import AiKnowledgeDocumentIndexing from "../../models/AiKnowledgeDocumentIndexing";
import AiKnowledgeDocumentChunk from "../../models/AiKnowledgeDocumentChunk";
import {
  characterCountPreview,
  findKnowledgeDocumentOrThrow
} from "./knowledgeBaseTenant";

export default async function ShowKnowledgeDocumentService(input: {
  companyId: number;
  id: number;
}): Promise<Record<string, unknown>> {
  const doc = await findKnowledgeDocumentOrThrow(input.companyId, input.id);

  const [lastProcessing, lastIndexing, chunksPreview] = await Promise.all([
    AiKnowledgeDocumentProcessing.findOne({
      where: {
        companyId: input.companyId,
        knowledgeDocumentId: doc.id
      },
      order: [["id", "DESC"]]
    }),
    AiKnowledgeDocumentIndexing.findOne({
      where: {
        companyId: input.companyId,
        knowledgeDocumentId: doc.id
      },
      order: [["id", "DESC"]]
    }),
    AiKnowledgeDocumentChunk.findAll({
      where: {
        companyId: input.companyId,
        knowledgeDocumentId: doc.id,
        enabled: true
      },
      attributes: [
        "id",
        "chunkIndex",
        "content",
        "sectionTitle",
        "tokenCount",
        "characterStart",
        "characterEnd"
      ],
      order: [["chunkIndex", "ASC"]],
      limit: 50
    })
  ]);

  return {
    ...doc.toJSON(),
    characterCount: characterCountPreview(doc),
    lastProcessing: lastProcessing ? lastProcessing.toJSON() : null,
    lastIndexing: lastIndexing ? lastIndexing.toJSON() : null,
    chunks: chunksPreview.map(c => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      sectionTitle: c.sectionTitle,
      tokenCount: c.tokenCount,
      characterStart: c.characterStart,
      characterEnd: c.characterEnd
    }))
  };
}
