import AiAgent from "../../../models/AiAgent";
import AiAgentKnowledgeSettings from "../../../models/AiAgentKnowledgeSettings";
import AppError from "../../../errors/AppError";
import { AI_AGENT_KNOWLEDGE_DEFAULTS } from "../../../config/aiAgentKnowledgeConstants";

export function serializeAiAgentKnowledgeSettings(
  row: AiAgentKnowledgeSettings
) {
  return {
    id: row.id,
    companyId: row.companyId,
    aiAgentId: row.aiAgentId,
    enabled: row.enabled,
    enabledInSimulator: row.enabledInSimulator,
    enabledInShadow: row.enabledInShadow,
    enabledInLive: row.enabledInLive,
    topK: row.topK,
    minimumScore: row.minimumScore,
    maxContextCharacters: row.maxContextCharacters,
    maxContextTokens: row.maxContextTokens,
    maxChunksPerDocument: row.maxChunksPerDocument,
    maxChunksPerBase: row.maxChunksPerBase,
    includeSourcesInInternalMetadata: row.includeSourcesInInternalMetadata,
    allowAnswerWithoutKnowledge: row.allowAnswerWithoutKnowledge,
    handoffWhenKnowledgeMissing: row.handoffWhenKnowledgeMissing,
    documentTypes: row.documentTypes,
    languages: row.languages,
    retrievalMode: row.retrievalMode,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function getOrCreateAiAgentKnowledgeSettings(input: {
  companyId: number;
  aiAgentId: number;
  userId?: number | null;
}): Promise<AiAgentKnowledgeSettings> {
  const agent = await AiAgent.findOne({
    where: { id: input.aiAgentId, companyId: input.companyId }
  });
  if (!agent) {
    throw new AppError("ERR_NO_AI_AGENT_FOUND", 404, "Agente não encontrado.");
  }

  let row = await AiAgentKnowledgeSettings.findOne({
    where: { companyId: input.companyId, aiAgentId: input.aiAgentId }
  });
  if (!row) {
    row = await AiAgentKnowledgeSettings.create({
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      enabled: AI_AGENT_KNOWLEDGE_DEFAULTS.enabled,
      enabledInSimulator: AI_AGENT_KNOWLEDGE_DEFAULTS.enabledInSimulator,
      enabledInShadow: AI_AGENT_KNOWLEDGE_DEFAULTS.enabledInShadow,
      enabledInLive: AI_AGENT_KNOWLEDGE_DEFAULTS.enabledInLive,
      topK: AI_AGENT_KNOWLEDGE_DEFAULTS.topK,
      minimumScore: AI_AGENT_KNOWLEDGE_DEFAULTS.minimumScore,
      maxContextCharacters: AI_AGENT_KNOWLEDGE_DEFAULTS.maxContextCharacters,
      maxContextTokens: AI_AGENT_KNOWLEDGE_DEFAULTS.maxContextTokens,
      maxChunksPerDocument: AI_AGENT_KNOWLEDGE_DEFAULTS.maxChunksPerDocument,
      maxChunksPerBase: AI_AGENT_KNOWLEDGE_DEFAULTS.maxChunksPerBase,
      includeSourcesInInternalMetadata:
        AI_AGENT_KNOWLEDGE_DEFAULTS.includeSourcesInInternalMetadata,
      allowAnswerWithoutKnowledge:
        AI_AGENT_KNOWLEDGE_DEFAULTS.allowAnswerWithoutKnowledge,
      handoffWhenKnowledgeMissing:
        AI_AGENT_KNOWLEDGE_DEFAULTS.handoffWhenKnowledgeMissing,
      retrievalMode: AI_AGENT_KNOWLEDGE_DEFAULTS.retrievalMode,
      documentTypes: null,
      languages: null,
      metadata: null,
      createdBy: input.userId ?? null,
      updatedBy: input.userId ?? null
    });
  }
  return row;
}

export default async function ShowAiAgentKnowledgeSettingsService(input: {
  companyId: number;
  aiAgentId: number;
  userId?: number | null;
}): Promise<AiAgentKnowledgeSettings> {
  return getOrCreateAiAgentKnowledgeSettings(input);
}
