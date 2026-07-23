import { getCognitiveMemoryConfig } from "./CognitiveMemoryConfig";
import { MemoryProvider } from "./MemoryProvider";
import { defaultSqlMemoryProvider } from "./providers/SqlMemoryProvider";
import { scoreAndSort, recordMemoryAccess } from "./MemoryScoring";
import { recordRetrievalScores } from "./CognitiveMemoryMetrics";
import { MemoryQuery, ScoredMemory } from "./memoryTypes";

/**
 * MemoryRetriever — seleciona, combina, ordena e filtra.
 * Não conhece banco; usa MemoryProvider.
 */
export class MemoryRetriever {
  constructor(private readonly provider: MemoryProvider = defaultSqlMemoryProvider) {}

  async retrieve(query: MemoryQuery): Promise<ScoredMemory[]> {
    const cfg = getCognitiveMemoryConfig(query.tenantId);
    const limit = Math.min(
      query.limit || cfg.limits.maxResultsPerQuery,
      cfg.limits.maxResultsPerQuery
    );

    const objects = await this.provider.search({
      ...query,
      limit: Math.max(limit * 2, limit) // fetch extra then score-trim
    });

    const scored = scoreAndSort({
      tenantId: query.tenantId,
      objects
    }).slice(0, limit);

    recordRetrievalScores(scored.map(s => s.score));

    for (const s of scored) {
      recordMemoryAccess(query.tenantId, s.object.id);
    }

    return scored;
  }
}

export const defaultMemoryRetriever = new MemoryRetriever();

export default MemoryRetriever;
