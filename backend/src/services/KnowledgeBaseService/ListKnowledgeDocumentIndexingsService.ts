import AiKnowledgeDocumentIndexing from "../../models/AiKnowledgeDocumentIndexing";
import { findKnowledgeDocumentOrThrow } from "./knowledgeBaseTenant";

export default async function ListKnowledgeDocumentIndexingsService(input: {
  companyId: number;
  knowledgeDocumentId: number;
}) {
  await findKnowledgeDocumentOrThrow(
    input.companyId,
    input.knowledgeDocumentId
  );
  const indexings = await AiKnowledgeDocumentIndexing.findAll({
    where: {
      companyId: input.companyId,
      knowledgeDocumentId: input.knowledgeDocumentId
    },
    order: [["id", "DESC"]]
  });
  return { indexings, count: indexings.length };
}

export async function ShowKnowledgeDocumentIndexingService(input: {
  companyId: number;
  knowledgeDocumentId: number;
  indexingId: number;
}) {
  await findKnowledgeDocumentOrThrow(
    input.companyId,
    input.knowledgeDocumentId
  );
  const indexing = await AiKnowledgeDocumentIndexing.findOne({
    where: {
      id: input.indexingId,
      companyId: input.companyId,
      knowledgeDocumentId: input.knowledgeDocumentId
    }
  });
  if (!indexing) {
    const AppError = (await import("../../errors/AppError")).default;
    throw new AppError(
      "ERR_KNOWLEDGE_INDEXING_NOT_FOUND",
      404,
      "Histórico de indexação não encontrado."
    );
  }
  return indexing;
}
