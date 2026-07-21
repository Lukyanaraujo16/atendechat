/**
 * Interface de cache para Tools de leitura.
 * Arquitetura apenas — sem cache distribuído nesta fase.
 */
export type ToolCacheKey = string;

export type ToolCacheEntry<T = unknown> = {
  value: T;
  expiresAt: number;
};

export interface ToolCacheStore {
  get<T = unknown>(key: ToolCacheKey): Promise<T | null>;
  set<T = unknown>(
    key: ToolCacheKey,
    value: T,
    ttlSeconds: number
  ): Promise<void>;
  del(key: ToolCacheKey): Promise<void>;
}

/** No-op store — sempre miss. Preparação para Redis futuro. */
export class NoopToolCacheStore implements ToolCacheStore {
  async get<T = unknown>(_key: ToolCacheKey): Promise<T | null> {
    return null;
  }
  async set<T = unknown>(
    _key: ToolCacheKey,
    _value: T,
    _ttlSeconds: number
  ): Promise<void> {
    return;
  }
  async del(_key: ToolCacheKey): Promise<void> {
    return;
  }
}

export function buildToolCacheKey(parts: Array<string | number | null | undefined | unknown>): string {
  return parts.map(p => String(p ?? "")).join(":");
}

let defaultStore: ToolCacheStore = new NoopToolCacheStore();

export function getToolCacheStore(): ToolCacheStore {
  return defaultStore;
}

/** Test/injection hook — não usar em produção nesta fase. */
export function setToolCacheStoreForTests(store: ToolCacheStore): void {
  defaultStore = store;
}

export function resetToolCacheStore(): void {
  defaultStore = new NoopToolCacheStore();
}
