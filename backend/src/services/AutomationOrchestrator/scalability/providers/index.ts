import {
  AgentOsCacheProvider,
  AgentOsDistributedLockProvider,
  AgentOsRateLimitProvider,
  AgentOsIdempotencyProvider,
  AgentOsQueueProvider
} from "./types";
import {
  InMemoryCacheProvider,
  InMemoryLockProvider,
  InMemoryRateLimitProvider,
  InMemoryIdempotencyProvider,
  InMemoryQueueProvider
} from "./InMemoryProviders";
import {
  RedisCacheProvider,
  RedisLockProvider,
  RedisRateLimitProvider
} from "./RedisProviders";
import { SequelizeIdempotencyProvider } from "./SequelizeIdempotencyProvider";
import {
  getScalabilityConfig,
  resolveProviderMode
} from "../ScalabilityConfig";

let cacheProvider: AgentOsCacheProvider | null = null;
let lockProvider: AgentOsDistributedLockProvider | null = null;
let rateLimitProvider: AgentOsRateLimitProvider | null = null;
let idempotencyProvider: AgentOsIdempotencyProvider | null = null;
let queueProvider: AgentOsQueueProvider | null = null;

const memCache = new InMemoryCacheProvider();
const memLock = new InMemoryLockProvider();
const memRate = new InMemoryRateLimitProvider();
const memIdem = new InMemoryIdempotencyProvider();
const memQueue = new InMemoryQueueProvider();

export function getAgentOsCacheProvider(): AgentOsCacheProvider {
  if (cacheProvider) return cacheProvider;
  const mode = resolveProviderMode(getScalabilityConfig().cacheProvider);
  cacheProvider = mode === "redis" ? new RedisCacheProvider() : memCache;
  return cacheProvider;
}

export function getAgentOsLockProvider(): AgentOsDistributedLockProvider {
  if (lockProvider) return lockProvider;
  const mode = resolveProviderMode(
    getScalabilityConfig().distributedLockProvider
  );
  lockProvider = mode === "redis" ? new RedisLockProvider() : memLock;
  return lockProvider;
}

export function getAgentOsRateLimitProvider(): AgentOsRateLimitProvider {
  if (rateLimitProvider) return rateLimitProvider;
  const mode = resolveProviderMode(getScalabilityConfig().rateLimitProvider);
  rateLimitProvider =
    mode === "redis" ? new RedisRateLimitProvider() : memRate;
  return rateLimitProvider;
}

export function getAgentOsIdempotencyProvider(): AgentOsIdempotencyProvider {
  if (idempotencyProvider) return idempotencyProvider;
  const mode = resolveProviderMode(getScalabilityConfig().idempotencyProvider);
  // auto/redis: Sequelize is source of truth for durability; Redis locks used separately
  if (mode === "memory" && process.env.NODE_ENV === "test") {
    idempotencyProvider = memIdem;
  } else {
    idempotencyProvider = new SequelizeIdempotencyProvider();
  }
  return idempotencyProvider;
}

export function getAgentOsQueueProvider(): AgentOsQueueProvider {
  if (queueProvider) return queueProvider;
  // Bull wiring is optional; default in-memory for unit tests / local without Redis
  queueProvider = memQueue;
  return queueProvider;
}

/** Força providers in-memory (testes). */
export function useInMemoryAgentOsProviders(): void {
  cacheProvider = memCache;
  lockProvider = memLock;
  rateLimitProvider = memRate;
  idempotencyProvider = memIdem;
  queueProvider = memQueue;
  memCache.clear();
  memLock.clear();
  memRate.clear();
  memIdem.clear();
  memQueue.clear();
}

export function resetAgentOsProviders(): void {
  cacheProvider = null;
  lockProvider = null;
  rateLimitProvider = null;
  idempotencyProvider = null;
  queueProvider = null;
}
