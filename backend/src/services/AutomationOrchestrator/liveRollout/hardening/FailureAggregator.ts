import { redisExpire, redisHIncrBy, redisHGetAll } from "../../../../libs/cache";
import { logger } from "../../../../utils/logger";

const mem = new Map<string, Record<string, number>>();

function key(companyId: number, dimension: string): string {
  return `automation:live:failagg:${companyId}:${dimension}`;
}

/**
 * Failure Aggregator — consolida falhas por provider/tool/empresa/agente/conexão.
 */
export async function recordFailureAggregate(input: {
  companyId: number;
  dimension: "provider" | "tool" | "agent" | "connection" | "company";
  id: string | number;
  kind?: string;
}): Promise<void> {
  const field = `${input.id}:${input.kind || "failure"}`;
  const k = key(input.companyId, input.dimension);
  const local = mem.get(k) || {};
  local[field] = (local[field] || 0) + 1;
  mem.set(k, local);

  try {
    await redisHIncrBy(k, field, 1);
    await redisExpire(k, 60 * 60 * 24 * 14);
  } catch (err) {
    logger.debug({ err }, "[LiveHardening] fail_agg_redis_fail");
  }
}

export async function getFailureAggregates(input: {
  companyId: number;
  dimension: "provider" | "tool" | "agent" | "connection" | "company";
}): Promise<Array<{ id: string; kind: string; count: number }>> {
  const k = key(input.companyId, input.dimension);
  let data: Record<string, number> = { ...(mem.get(k) || {}) };
  try {
    const remote = await redisHGetAll(k);
    for (const [f, v] of Object.entries(remote || {})) {
      data[f] = Math.max(data[f] || 0, Number(v) || 0);
    }
  } catch {
    // local only
  }
  return Object.entries(data)
    .map(([field, count]) => {
      const [id, kind] = field.split(":");
      return { id: id || field, kind: kind || "failure", count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

export function __resetFailureAggregatorForTests(): void {
  mem.clear();
}

export default { recordFailureAggregate, getFailureAggregates };
