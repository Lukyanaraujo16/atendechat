import { randomUUID } from "crypto";
import * as cache from "../../../../libs/cache";
import {
  AgentOsCacheProvider,
  AgentOsDistributedLockProvider,
  AgentOsRateLimitProvider
} from "./types";
import { logger } from "../../../../utils/logger";

const PREFIX = "agentos:";

export class RedisCacheProvider implements AgentOsCacheProvider {
  async get(key: string): Promise<string | null> {
    try {
      const v = await cache.get(`${PREFIX}c:${key}`);
      return v == null ? null : String(v);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    await cache.set(`${PREFIX}c:${key}`, value, "EX", ttlSec);
  }

  async del(key: string): Promise<void> {
    await cache.del(`${PREFIX}c:${key}`);
  }

  async delByPrefix(prefix: string): Promise<number> {
    try {
      await cache.delFromPattern(`${PREFIX}c:${prefix}*`);
      return 1;
    } catch {
      return 0;
    }
  }
}

export class RedisLockProvider implements AgentOsDistributedLockProvider {
  async acquire(key: string, ownerToken: string, ttlMs: number) {
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    try {
      const acquired = await cache.setNx(
        `${PREFIX}lock:${key}`,
        ownerToken,
        ttlSec
      );
      return { acquired, unavailable: false };
    } catch (err) {
      logger.warn({ err, key }, "[AgentOS] lock Redis unavailable");
      return { acquired: false, unavailable: true };
    }
  }

  async release(key: string, ownerToken: string) {
    try {
      const full = `${PREFIX}lock:${key}`;
      const cur = await cache.get(full);
      if (cur != null && String(cur) !== ownerToken) return false;
      await cache.del(full);
      return true;
    } catch {
      return false;
    }
  }

  async extend(key: string, ownerToken: string, ttlMs: number) {
    try {
      const full = `${PREFIX}lock:${key}`;
      const cur = await cache.get(full);
      if (cur == null || String(cur) !== ownerToken) return false;
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await cache.set(full, ownerToken, "EX", ttlSec);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Fixed window rate limit via Redis INCR + EXPIRE.
 * Fail-closed for AgentOS admin (unavailable → not allowed) quando critical=true.
 */
export class RedisRateLimitProvider implements AgentOsRateLimitProvider {
  async take(input: {
    scope: string;
    key: string;
    windowMs: number;
    max: number;
  }) {
    const windowSec = Math.max(1, Math.ceil(input.windowMs / 1000));
    const bucket = Math.floor(Date.now() / input.windowMs);
    const redisKey = `${PREFIX}rl:${input.scope}:${input.key}:${bucket}`;
    try {
      const count = await cache.redisIncr(redisKey);
      if (count === 1) {
        await cache.set(redisKey, "1", "EX", windowSec + 1);
      }
      const allowed = count <= input.max;
      return {
        allowed,
        remaining: Math.max(0, input.max - count),
        unavailable: false
      };
    } catch (err) {
      logger.warn({ err }, "[AgentOS] rate limit Redis unavailable — fail-closed");
      return { allowed: false, remaining: 0, unavailable: true };
    }
  }
}

export function newLockOwnerToken(): string {
  return `${Date.now()}:${randomUUID()}`;
}
