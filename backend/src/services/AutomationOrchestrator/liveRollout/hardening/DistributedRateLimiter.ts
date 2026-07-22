import {
  redisExpire,
  redisZAdd,
  redisZCard,
  redisZCount,
  redisZRemRangeByScore
} from "../../../../libs/cache";
import { DEFAULT_LIVE_HARDENING_CONFIG } from "../../../../config/automationLiveHardeningConstants";
import { logger } from "../../../../utils/logger";

type Bucket = number[];
const mem = new Map<string, Bucket>();

function keyOf(
  scope: "company" | "connection" | "agent" | "provider" | "tool",
  companyId: number,
  id: string | number
): string {
  return `automation:live:rl:${scope}:${companyId}:${id}`;
}

function limitFor(
  scope: "company" | "connection" | "agent" | "provider" | "tool"
): number {
  const c = DEFAULT_LIVE_HARDENING_CONFIG.rateLimit;
  switch (scope) {
    case "company":
      return c.companyPerMinute;
    case "connection":
      return c.connectionPerMinute;
    case "agent":
      return c.agentPerMinute;
    case "provider":
      return c.providerPerMinute;
    case "tool":
      return c.toolPerMinute;
    default:
      return 60;
  }
}

function memCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let b = mem.get(key);
  if (!b) {
    b = [];
    mem.set(key, b);
  }
  while (b.length && b[0] < now - windowMs) b.shift();
  if (b.length >= limit) return false;
  b.push(now);
  return true;
}

/**
 * Rate limiter distribuído (ZSET sliding window) com fallback memória.
 */
export async function checkDistributedRateLimit(input: {
  scope: "company" | "connection" | "agent" | "provider" | "tool";
  companyId: number;
  id: string | number;
}): Promise<{ allowed: boolean; limit: number; remaining: number }> {
  const limit = limitFor(input.scope);
  const windowMs = 60_000;
  const key = keyOf(input.scope, input.companyId, input.id);
  const now = Date.now();

  try {
    await redisZRemRangeByScore(key, 0, now - windowMs);
    const count = await redisZCard(key);
    if (count >= limit) {
      return { allowed: false, limit, remaining: 0 };
    }
    await redisZAdd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
    await redisExpire(key, 120);
    const after = await redisZCount(key, now - windowMs, now + 1);
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - after)
    };
  } catch (err) {
    logger.debug({ err }, "[LiveHardening] rate_limit_redis_fail");
    const ok = memCheck(key, limit, windowMs);
    return {
      allowed: ok,
      limit,
      remaining: ok ? limit - 1 : 0
    };
  }
}

export async function assertLiveRateLimits(input: {
  companyId: number;
  connectionId: number;
  agentId: number;
  provider?: string | null;
}): Promise<{ allowed: boolean; blockedBy?: string }> {
  const checks: Array<{
    scope: "company" | "connection" | "agent" | "provider";
    id: string | number;
  }> = [
    { scope: "company", id: input.companyId },
    { scope: "connection", id: input.connectionId },
    { scope: "agent", id: input.agentId }
  ];
  if (input.provider) {
    checks.push({ scope: "provider", id: input.provider });
  }
  for (const c of checks) {
    const r = await checkDistributedRateLimit({
      scope: c.scope,
      companyId: input.companyId,
      id: c.id
    });
    if (!r.allowed) {
      return { allowed: false, blockedBy: `${c.scope}:${c.id}` };
    }
  }
  return { allowed: true };
}

export function __resetDistributedRateLimitForTests(): void {
  mem.clear();
}

export default { checkDistributedRateLimit, assertLiveRateLimits };
