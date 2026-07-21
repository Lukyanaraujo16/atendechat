import { randomUUID } from "crypto";
import { del, setNx } from "../../../../libs/cache";
import { logger } from "../../../../utils/logger";
import { OperationResourceType } from "../../../../config/automationOperationConstants";

/**
 * Lock distribuído por recurso (contact/ticket/tag).
 * Fail-closed em escrita se Redis indisponível.
 */
export async function acquireOperationResourceLock(input: {
  companyId: number;
  resourceType: OperationResourceType;
  resourceId: string | number;
  ttlSeconds?: number;
}): Promise<{ acquired: boolean; key: string; redisUnavailable: boolean }> {
  const key = `automation:op:lock:${input.companyId}:${input.resourceType}:${input.resourceId}`;
  const ttl = Math.max(15, input.ttlSeconds ?? 60);
  try {
    const acquired = await setNx(key, `${Date.now()}:${randomUUID()}`, ttl);
    return { acquired, key, redisUnavailable: false };
  } catch (err) {
    logger.warn(
      { err, key },
      "[AutomationOperations] resource lock Redis indisponível — fail-closed"
    );
    return { acquired: false, key, redisUnavailable: true };
  }
}

export async function releaseOperationResourceLock(key: string): Promise<void> {
  try {
    await del(key);
  } catch {
    // TTL
  }
}

export async function acquireMultipleResourceLocks(input: {
  companyId: number;
  resources: Array<{ type: OperationResourceType; id: string | number }>;
  ttlSeconds?: number;
}): Promise<{
  acquired: boolean;
  keys: string[];
  redisUnavailable: boolean;
}> {
  const keys: string[] = [];
  for (const r of input.resources) {
    const lock = await acquireOperationResourceLock({
      companyId: input.companyId,
      resourceType: r.type,
      resourceId: r.id,
      ttlSeconds: input.ttlSeconds
    });
    if (!lock.acquired) {
      for (const k of keys) await releaseOperationResourceLock(k);
      return {
        acquired: false,
        keys: [],
        redisUnavailable: lock.redisUnavailable
      };
    }
    keys.push(lock.key);
  }
  return { acquired: true, keys, redisUnavailable: false };
}
