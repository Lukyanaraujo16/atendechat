import AppError from "../../../errors/AppError";
import AiKnowledgeRetrieval from "../../../models/AiKnowledgeRetrieval";
import AiAgent from "../../../models/AiAgent";

function serializeRetrieval(row: AiKnowledgeRetrieval) {
  return {
    id: row.id,
    companyId: row.companyId,
    aiAgentId: row.aiAgentId,
    channel: row.channel,
    ticketId: row.ticketId,
    messageId: row.messageId,
    simulationSessionId: row.simulationSessionId,
    shadowSuggestionId: row.shadowSuggestionId,
    requestId: row.requestId,
    status: row.status,
    queryHash: row.queryHash,
    queryPreview: row.queryPreview,
    knowledgeBaseIds: row.knowledgeBaseIds,
    documentTypes: row.documentTypes,
    languages: row.languages,
    topK: row.topK,
    minimumScore: row.minimumScore,
    candidateCount: row.candidateCount,
    returnedChunkCount: row.returnedChunkCount,
    returnedDocumentCount: row.returnedDocumentCount,
    embeddingProvider: row.embeddingProvider,
    embeddingModel: row.embeddingModel,
    embeddingDimensions: row.embeddingDimensions,
    contextCharacters: row.contextCharacters,
    estimatedContextTokens: row.estimatedContextTokens,
    durationMs: row.durationMs,
    embeddingDurationMs: row.embeddingDurationMs,
    searchDurationMs: row.searchDurationMs,
    skippedReason: row.skippedReason,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export default async function ListKnowledgeRetrievalsService(input: {
  companyId: number;
  aiAgentId: number;
  channel?: string;
  status?: string;
  pageNumber?: string;
}) {
  const agent = await AiAgent.findOne({
    where: { id: input.aiAgentId, companyId: input.companyId }
  });
  if (!agent) {
    throw new AppError("ERR_NO_AI_AGENT_FOUND", 404, "Agente não encontrado.");
  }

  const page = Math.max(1, Number(input.pageNumber) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  const where: Record<string, unknown> = {
    companyId: input.companyId,
    aiAgentId: input.aiAgentId
  };
  if (input.channel) where.channel = String(input.channel);
  if (input.status) where.status = String(input.status);

  const { rows, count } = await AiKnowledgeRetrieval.findAndCountAll({
    where,
    order: [["id", "DESC"]],
    limit,
    offset
  });

  return {
    retrievals: rows.map(serializeRetrieval),
    count,
    hasMore: count > offset + rows.length
  };
}

export async function ShowKnowledgeRetrievalService(input: {
  companyId: number;
  aiAgentId: number;
  retrievalId: number;
}) {
  const row = await AiKnowledgeRetrieval.findOne({
    where: {
      id: input.retrievalId,
      companyId: input.companyId,
      aiAgentId: input.aiAgentId
    }
  });
  if (!row) {
    throw new AppError(
      "ERR_KNOWLEDGE_RETRIEVAL_NOT_FOUND",
      404,
      "Registro de recuperação não encontrado."
    );
  }
  return serializeRetrieval(row);
}

export { serializeRetrieval };
