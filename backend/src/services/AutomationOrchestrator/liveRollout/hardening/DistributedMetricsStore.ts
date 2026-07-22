import {
  redisGet,
  redisSet,
  redisExpire,
  redisHGetAll,
  redisHIncrBy,
  redisPing
} from "../../../../libs/cache";
import { logger } from "../../../../utils/logger";

const PREFIX = "automation:live:metrics";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

type MemCounter = Record<string, number>;
const memByCompany = new Map<number, MemCounter>();

function mem(companyId: number): MemCounter {
  let m = memByCompany.get(companyId);
  if (!m) {
    m = {};
    memByCompany.set(companyId, m);
  }
  return m;
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashKey(companyId: number): string {
  return `${PREFIX}:${companyId}:${dayKey()}`;
}

async function bump(
  companyId: number,
  field: string,
  n = 1
): Promise<void> {
  mem(companyId)[field] = (mem(companyId)[field] || 0) + n;
  try {
    const key = hashKey(companyId);
    await redisHIncrBy(key, field, n);
    await redisExpire(key, TTL_SECONDS);
  } catch (err) {
    logger.debug({ err, companyId, field }, "[LiveHardening] metrics_redis_fail");
  }
}

export async function recordDistributedMetric(input: {
  companyId: number;
  field:
    | "rollouts"
    | "fallbacks"
    | "timeouts"
    | "toolFailures"
    | "providerFailures"
    | "liveExecutions"
    | "eligible"
    | "ineligible"
    | "tokens"
    | "costMicros"
    | "latencySum"
    | "latencyCount"
    | "verification"
    | "hallucinations"
    | "rollbacks"
    | "circuitOpens";
  n?: number;
}): Promise<void> {
  await bump(input.companyId, input.field, input.n ?? 1);
}

export async function recordDistributedLatency(
  companyId: number,
  latencyMs: number
): Promise<void> {
  await bump(companyId, "latencySum", Math.max(0, Math.floor(latencyMs)));
  await bump(companyId, "latencyCount", 1);
}

export async function getDistributedMetricsSnapshot(
  companyId: number
): Promise<Record<string, number>> {
  const local = { ...mem(companyId) };
  try {
    const remote = await redisHGetAll(hashKey(companyId));
    for (const [k, v] of Object.entries(remote || {})) {
      const n = Number(v) || 0;
      // Preferir Redis (cross-instance); local como floor se Redis vazio
      local[k] = Math.max(local[k] || 0, n);
    }
  } catch {
    // keep local
  }
  const latencyCount = local.latencyCount || 0;
  return {
    ...local,
    averageLatency: latencyCount
      ? Math.round((local.latencySum || 0) / latencyCount)
      : 0
  };
}

export async function isDistributedStoreHealthy(): Promise<boolean> {
  return redisPing();
}

/** Cooldown / guard keys */
export async function setGuardTimestamp(
  key: string,
  ttlSeconds: number
): Promise<void> {
  const now = Date.now();
  memGuard.set(key, now);
  try {
    await redisSet(key, String(now), ttlSeconds);
  } catch {
    // memória já atualizada
  }
}

const memGuard = new Map<string, number>();

export async function getGuardTimestamp(key: string): Promise<number | null> {
  try {
    const v = await redisGet(key);
    if (v) return Number(v) || null;
  } catch {
    // fallthrough
  }
  return memGuard.get(key) ?? null;
}

export function __resetDistributedMetricsForTests(): void {
  memByCompany.clear();
  memGuard.clear();
}

export default {
  recordDistributedMetric,
  getDistributedMetricsSnapshot
};
