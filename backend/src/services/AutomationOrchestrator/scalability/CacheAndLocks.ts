import { getAgentOsCacheProvider, getAgentOsLockProvider } from "./providers";
import { getScalabilityConfig } from "./ScalabilityConfig";
import { newLockOwnerToken } from "./providers/RedisProviders";
import { observeAgentOsStep } from "../observability/observeAgentOsStep";

export function tenantCacheKey(
  companyId: number,
  resourceType: string,
  resourceId?: string | number | null,
  version?: string | number | null,
  scope?: string | null
): string {
  const parts = [
    `co:${companyId}`,
    `rt:${resourceType}`,
    resourceId != null ? `id:${resourceId}` : "id:_",
    version != null ? `v:${version}` : "v:_",
    scope != null ? `sc:${scope}` : "sc:_"
  ];
  return parts.join("|");
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await getAgentOsCacheProvider().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlMs?: number
): Promise<void> {
  const ttl = ttlMs ?? getScalabilityConfig().cacheTtlMs;
  await getAgentOsCacheProvider().set(key, JSON.stringify(value), ttl);
}

export async function invalidateTenantCache(
  companyId: number,
  resourceType?: string
): Promise<number> {
  const prefix = resourceType
    ? `co:${companyId}|rt:${resourceType}`
    : `co:${companyId}|`;
  const n = await getAgentOsCacheProvider().delByPrefix(prefix);
  try {
    observeAgentOsStep({
      companyId,
      origin: "system",
      type: "cache.invalidate",
      latencyMs: 0,
      success: true,
      finish: true
    });
  } catch {
    /* fail-open */
  }
  return n;
}

export const CACHE_INVALIDATION_EVENTS = [
  "agent_profile_changed",
  "agent_version_created",
  "plan_changed",
  "permissions_changed",
  "feature_flag_changed",
  "tool_policy_changed",
  "mcp_changed",
  "memory_policy_changed",
  "learning_policy_changed",
  "agent_suspended",
  "credential_rotated",
  "agentos_config_changed"
] as const;

export type CacheInvalidationEvent = (typeof CACHE_INVALIDATION_EVENTS)[number];

export async function emitCacheInvalidation(input: {
  companyId: number;
  event: CacheInvalidationEvent;
  resourceType?: string;
}): Promise<void> {
  await invalidateTenantCache(input.companyId, input.resourceType);
}

export async function withDistributedLock<T>(input: {
  companyId: number;
  resource: string;
  resourceId: string;
  ttlMs?: number;
  critical?: boolean;
  fn: () => Promise<T>;
}): Promise<T> {
  const lock = getAgentOsLockProvider();
  const key = `co:${input.companyId}:${input.resource}:${input.resourceId}`;
  const owner = newLockOwnerToken();
  const ttl = input.ttlMs ?? getScalabilityConfig().lockDefaultTtlMs;
  const acq = await lock.acquire(key, owner, ttl);
  if (!acq.acquired) {
    if (acq.unavailable && input.critical !== false) {
      throw new Error("ERR_AGENTOS_LOCK_UNAVAILABLE");
    }
    throw new Error("ERR_AGENTOS_LOCK_CONTENTION");
  }
  try {
    return await input.fn();
  } finally {
    await lock.release(key, owner);
  }
}
