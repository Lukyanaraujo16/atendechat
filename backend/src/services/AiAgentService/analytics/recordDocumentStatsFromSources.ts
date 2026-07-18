import { logger } from "../../../utils/logger";
import AiKnowledgeDocumentStats from "../../../models/AiKnowledgeDocumentStats";

export type DocumentStatsSource = {
  documentId: number;
  knowledgeBaseId: number;
  score?: number;
  rank?: number;
};

async function recordDocumentStatsFromSources(input: {
  companyId: number;
  aiAgentId: number;
  sources: DocumentStatsSource[];
  failed?: boolean;
}): Promise<void> {
  const sources = Array.isArray(input.sources) ? input.sources : [];
  if (sources.length === 0 && !input.failed) return;

  const seen = new Set<number>();
  const now = new Date();

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    const documentId = Number(source?.documentId);
    const knowledgeBaseId = Number(source?.knowledgeBaseId);
    if (!Number.isFinite(documentId) || documentId <= 0) continue;
    if (!Number.isFinite(knowledgeBaseId) || knowledgeBaseId <= 0) continue;
    if (seen.has(documentId)) continue;
    seen.add(documentId);

    const [row] = await AiKnowledgeDocumentStats.findOrCreate({
      where: {
        companyId: input.companyId,
        documentId
      },
      defaults: {
        companyId: input.companyId,
        documentId,
        knowledgeBaseId,
        retrievalCount: 0,
        top1Count: 0,
        sumScore: 0,
        sumRank: 0,
        scoreSamples: 0,
        sumChunksReturned: 0,
        retrievalFailures: 0,
        lastRetrievedAt: null,
        lastUsedByAgentId: null,
        metadata: null
      }
    });

    const patch: Record<string, unknown> = {
      retrievalCount: Number(row.retrievalCount || 0) + 1,
      lastRetrievedAt: now,
      lastUsedByAgentId: input.aiAgentId,
      knowledgeBaseId: row.knowledgeBaseId || knowledgeBaseId,
      sumChunksReturned: Number(row.sumChunksReturned || 0) + 1
    };

    if (i === 0) {
      patch.top1Count = Number(row.top1Count || 0) + 1;
    }

    if (source.score != null && Number.isFinite(Number(source.score))) {
      patch.sumScore = Number(row.sumScore || 0) + Number(source.score);
      patch.scoreSamples = Number(row.scoreSamples || 0) + 1;
    }
    if (source.rank != null && Number.isFinite(Number(source.rank))) {
      patch.sumRank = Number(row.sumRank || 0) + Number(source.rank);
    } else {
      patch.sumRank = Number(row.sumRank || 0) + (i + 1);
    }

    await row.update(patch);
  }

  if (input.failed && sources.length === 0) {
    // Falha sem sources: nada a incrementar por documento.
  }
}

export async function safeRecordDocumentStatsFromSources(
  input: Parameters<typeof recordDocumentStatsFromSources>[0]
): Promise<void> {
  try {
    await recordDocumentStatsFromSources(input);
  } catch (err) {
    logger.warn(
      { err, companyId: input.companyId, aiAgentId: input.aiAgentId },
      "safeRecordDocumentStatsFromSources failed"
    );
  }
}

export default recordDocumentStatsFromSources;
