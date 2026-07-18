import EnqueueKnowledgeDocumentIndexingService from "./EnqueueKnowledgeDocumentIndexingService";

export default async function ReindexKnowledgeDocumentService(input: {
  companyId: number;
  knowledgeDocumentId: number;
}) {
  return EnqueueKnowledgeDocumentIndexingService({
    companyId: input.companyId,
    knowledgeDocumentId: input.knowledgeDocumentId,
    force: true
  });
}
