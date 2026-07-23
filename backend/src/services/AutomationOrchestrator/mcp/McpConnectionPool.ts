import { getMcpConfig } from "./McpConfig";
import { McpConnectionState } from "../../../config/automationMcpConstants";
import { McpConnectionRecord } from "./types";

type PoolEntry = McpConnectionRecord & {
  client: FakeOrRealClient | null;
};

/**
 * Client mínimo injetável — testes usam Fake; produção usa SDK Client.
 */
export type FakeOrRealClient = {
  listTools: () => Promise<{
    tools: Array<{
      name: string;
      title?: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
      annotations?: Record<string, unknown>;
    }>;
  }>;
  callTool: (input: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<{
    content?: Array<{ type: string; text?: string; [k: string]: unknown }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  }>;
  close?: () => Promise<void>;
};

const pool = new Map<string, PoolEntry>();

export function poolKey(companyId: number, serverId: string): string {
  return `${companyId}:${serverId}`;
}

export class McpConnectionPool {
  get(companyId: number, serverId: string): PoolEntry | null {
    return pool.get(poolKey(companyId, serverId)) || null;
  }

  async acquire(input: {
    companyId: number;
    serverId: string;
    connect: () => Promise<FakeOrRealClient>;
  }): Promise<PoolEntry> {
    const cfg = getMcpConfig(input.companyId);
    const key = poolKey(input.companyId, input.serverId);
    let entry = pool.get(key);

    if (entry?.state === "CONNECTED" && entry.client) {
      entry.lastUsedAt = new Date().toISOString();
      entry.activeExecutions += 1;
      pool.set(key, entry);
      return entry;
    }

    if (pool.size >= cfg.maxConnections && !entry) {
      this.evictIdle(cfg.idleConnectionTimeoutMs);
    }

    const now = new Date().toISOString();
    entry = {
      key,
      companyId: input.companyId,
      serverId: input.serverId,
      state: "CONNECTING",
      createdAt: now,
      lastUsedAt: now,
      activeExecutions: 1,
      failureCount: entry?.failureCount || 0,
      lastError: null,
      client: null
    };
    pool.set(key, entry);

    try {
      const client = await input.connect();
      entry.client = client;
      entry.state = "CONNECTED";
      entry.lastUsedAt = new Date().toISOString();
      pool.set(key, entry);
      return entry;
    } catch (err) {
      entry.state = "FAILED";
      entry.failureCount += 1;
      entry.lastError = err instanceof Error ? err.message : String(err);
      entry.activeExecutions = Math.max(0, entry.activeExecutions - 1);
      pool.set(key, entry);
      if (entry.failureCount >= cfg.maxFailuresBeforeEviction) {
        await this.release(input.companyId, input.serverId);
      }
      throw err;
    }
  }

  releaseExecution(companyId: number, serverId: string): void {
    const entry = pool.get(poolKey(companyId, serverId));
    if (!entry) return;
    entry.activeExecutions = Math.max(0, entry.activeExecutions - 1);
    entry.lastUsedAt = new Date().toISOString();
    pool.set(entry.key, entry);
  }

  async release(companyId: number, serverId: string): Promise<void> {
    const key = poolKey(companyId, serverId);
    const entry = pool.get(key);
    if (!entry) return;
    entry.state = "CLOSING";
    try {
      await entry.client?.close?.();
    } catch {
      // ignore close errors
    }
    pool.delete(key);
  }

  evictIdle(idleTimeoutMs: number): void {
    const now = Date.now();
    for (const [key, entry] of pool.entries()) {
      if (entry.activeExecutions > 0) continue;
      const idle = now - Date.parse(entry.lastUsedAt);
      if (idle >= idleTimeoutMs) {
        void this.release(entry.companyId, entry.serverId);
        pool.delete(key);
      }
    }
  }

  list(companyId?: number): McpConnectionRecord[] {
    return Array.from(pool.values())
      .filter(e => (companyId == null ? true : e.companyId === companyId))
      .map(({ client: _c, ...rest }) => ({ ...rest }));
  }

  setState(
    companyId: number,
    serverId: string,
    state: McpConnectionState,
    error?: string | null
  ): void {
    const entry = pool.get(poolKey(companyId, serverId));
    if (!entry) return;
    entry.state = state;
    if (error !== undefined) entry.lastError = error;
    pool.set(entry.key, entry);
  }
}

export const defaultMcpConnectionPool = new McpConnectionPool();

export function __resetMcpConnectionPoolForTests(): void {
  for (const e of defaultMcpConnectionPool.list()) {
    void defaultMcpConnectionPool.release(e.companyId, e.serverId);
  }
}

export default defaultMcpConnectionPool;
