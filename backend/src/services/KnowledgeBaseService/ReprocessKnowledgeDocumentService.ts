import EnqueueKnowledgeDocumentProcessingService, {
  EnqueueProcessingResult
} from "./EnqueueKnowledgeDocumentProcessingService";

/**
 * Reprocessar: sempre força novo registo de histórico + nova fila.
 */
export default async function ReprocessKnowledgeDocumentService(input: {
  companyId: number;
  knowledgeDocumentId: number;
}): Promise<EnqueueProcessingResult> {
  return EnqueueKnowledgeDocumentProcessingService({
    companyId: input.companyId,
    knowledgeDocumentId: input.knowledgeDocumentId,
    force: true
  });
}
