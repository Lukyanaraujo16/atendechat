import {
  AgentOsCacheProvider,
  AgentOsDistributedLockProvider,
  AgentOsRateLimitProvider,
  AgentOsIdempotencyProvider,
  AgentOsIdempotencyRecord,
  AgentOsQueueProvider,
  AgentOsJobRecord
} from "./types";
import { AgentOsJobStatus } from "../../../../config/automationAgentOsScalabilityConstants";
import { createHash, randomBytes } from "crypto";

type MemEntry = { value: string; expiresAt: number };
type LockEntry = { owner: string; expiresAt: number };
type RateBucket = { count: number; resetAt: number };

function now() {
  return Date.now();
}

export class InMemoryCacheProvider implements AgentOsCacheProvider {
  private store = new Map<string, MemEntry>();

  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt <= now()) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: now() + Math.max(1, ttlMs) });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delByPrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const k of Array.from(this.store.keys())) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
        n += 1;
      }
    }
    return n;
  }

  clear() {
    this.store.clear();
  }
}

export class InMemoryLockProvider implements AgentOsDistributedLockProvider {
  private locks = new Map<string, LockEntry>();

  async acquire(key: string, ownerToken: string, ttlMs: number) {
    const cur = this.locks.get(key);
    if (cur && cur.expiresAt > now() && cur.owner !== ownerToken) {
      return { acquired: false, unavailable: false };
    }
    this.locks.set(key, { owner: ownerToken, expiresAt: now() + ttlMs });
    return { acquired: true, unavailable: false };
  }

  async release(key: string, ownerToken: string) {
    const cur = this.locks.get(key);
    if (!cur) return true;
    if (cur.owner !== ownerToken) return false;
    this.locks.delete(key);
    return true;
  }

  async extend(key: string, ownerToken: string, ttlMs: number) {
    const cur = this.locks.get(key);
    if (!cur || cur.owner !== ownerToken) return false;
    cur.expiresAt = now() + ttlMs;
    return true;
  }

  clear() {
    this.locks.clear();
  }
}

export class InMemoryRateLimitProvider implements AgentOsRateLimitProvider {
  private buckets = new Map<string, RateBucket>();

  async take(input: {
    scope: string;
    key: string;
    windowMs: number;
    max: number;
  }) {
    const k = `${input.scope}:${input.key}`;
    const t = now();
    let b = this.buckets.get(k);
    if (!b || t >= b.resetAt) {
      b = { count: 0, resetAt: t + input.windowMs };
      this.buckets.set(k, b);
    }
    if (b.count >= input.max) {
      return { allowed: false, remaining: 0, unavailable: false };
    }
    b.count += 1;
    return { allowed: true, remaining: input.max - b.count, unavailable: false };
  }

  clear() {
    this.buckets.clear();
  }
}

export class InMemoryIdempotencyProvider implements AgentOsIdempotencyProvider {
  private records = new Map<string, AgentOsIdempotencyRecord>();

  private id(companyId: number, key: string) {
    return `${companyId}:${key}`;
  }

  async claim(input: {
    companyId: number;
    key: string;
    operationType: string;
    requestHash: string;
    ownerId: string;
    ttlMs: number;
    processingTimeoutMs: number;
  }) {
    const k = this.id(input.companyId, input.key);
    const existing = this.records.get(k);
    const t = now();
    if (existing) {
      if (existing.requestHash !== input.requestHash) {
        return { outcome: "conflict_payload" as const, record: existing };
      }
      if (existing.status === "COMPLETED") {
        return { outcome: "replay" as const, record: existing };
      }
      if (existing.status === "AMBIGUOUS") {
        return { outcome: "ambiguous" as const, record: existing };
      }
      if (
        existing.status === "PROCESSING" &&
        existing.lockedUntil &&
        existing.lockedUntil.getTime() > t
      ) {
        return { outcome: "in_progress" as const, record: existing };
      }
      // expired processing → reclaim
    }
    const record: AgentOsIdempotencyRecord = {
      key: input.key,
      companyId: input.companyId,
      operationType: input.operationType,
      requestHash: input.requestHash,
      status: "PROCESSING",
      ownerId: input.ownerId,
      resultReference: null,
      errorCode: null,
      attemptCount: (existing?.attemptCount || 0) + 1,
      lockedUntil: new Date(t + input.processingTimeoutMs),
      expiresAt: new Date(t + input.ttlMs),
      createdAt: existing?.createdAt || new Date(t),
      updatedAt: new Date(t)
    };
    this.records.set(k, record);
    return { outcome: "acquired" as const, record };
  }

  async complete(input: {
    companyId: number;
    key: string;
    resultReference: string;
    ownerId: string;
  }) {
    const rec = this.records.get(this.id(input.companyId, input.key));
    if (!rec || rec.ownerId !== input.ownerId) return;
    rec.status = "COMPLETED";
    rec.resultReference = input.resultReference;
    rec.updatedAt = new Date();
    rec.lockedUntil = null;
  }

  async fail(input: {
    companyId: number;
    key: string;
    ownerId: string;
    errorCode: string;
    final: boolean;
  }) {
    const rec = this.records.get(this.id(input.companyId, input.key));
    if (!rec || rec.ownerId !== input.ownerId) return;
    rec.status = input.final ? "FAILED_FINAL" : "FAILED_RETRYABLE";
    rec.errorCode = input.errorCode;
    rec.updatedAt = new Date();
    rec.lockedUntil = null;
  }

  async markAmbiguous(input: {
    companyId: number;
    key: string;
    ownerId: string;
    errorCode: string;
  }) {
    const rec = this.records.get(this.id(input.companyId, input.key));
    if (!rec || rec.ownerId !== input.ownerId) return;
    rec.status = "AMBIGUOUS";
    rec.errorCode = input.errorCode;
    rec.updatedAt = new Date();
    rec.lockedUntil = null;
  }

  clear() {
    this.records.clear();
  }
}

export class InMemoryQueueProvider implements AgentOsQueueProvider {
  private jobs = new Map<string, AgentOsJobRecord>();

  async enqueue(input: {
    type: string;
    companyId?: number | null;
    payload: Record<string, unknown>;
    correlationId?: string | null;
    deduplicationKey?: string | null;
    delayMs?: number;
    maxAttempts?: number;
  }): Promise<AgentOsJobRecord> {
    if (input.deduplicationKey) {
      for (const j of this.jobs.values()) {
        if (
          j.deduplicationKey === input.deduplicationKey &&
          (j.status === "QUEUED" || j.status === "RUNNING" || j.status === "RETRY_SCHEDULED")
        ) {
          return j;
        }
      }
    }
    const jobId = `job_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    const record: AgentOsJobRecord = {
      jobId,
      companyId: input.companyId ?? null,
      type: input.type,
      payload: input.payload,
      status: "QUEUED",
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 5,
      scheduledAt: new Date(Date.now() + (input.delayMs || 0)).toISOString(),
      startedAt: null,
      finishedAt: null,
      errorCode: null,
      correlationId: input.correlationId ?? null,
      deduplicationKey: input.deduplicationKey ?? null
    };
    this.jobs.set(jobId, record);
    return record;
  }

  async getJob(jobId: string) {
    return this.jobs.get(jobId) || null;
  }

  async listJobs(opts?: {
    companyId?: number;
    status?: AgentOsJobStatus;
    limit?: number;
  }) {
    let list = Array.from(this.jobs.values());
    if (opts?.companyId != null) {
      list = list.filter(j => j.companyId === opts.companyId);
    }
    if (opts?.status) list = list.filter(j => j.status === opts.status);
    return list.slice(0, opts?.limit || 100);
  }

  async markDeadLetter(jobId: string, errorCode: string) {
    const j = this.jobs.get(jobId);
    if (!j) return;
    j.status = "DEAD_LETTER";
    j.errorCode = errorCode;
    j.finishedAt = new Date().toISOString();
  }

  async requeue(jobId: string) {
    const j = this.jobs.get(jobId);
    if (!j) return null;
    j.status = "QUEUED";
    j.errorCode = null;
    j.finishedAt = null;
    j.scheduledAt = new Date().toISOString();
    return j;
  }

  /** Simula worker processando (testes). */
  async runNext(
    handler: (job: AgentOsJobRecord) => Promise<"ok" | "retry" | "fail" | "ambiguous">
  ) {
    const job = Array.from(this.jobs.values()).find(j => j.status === "QUEUED");
    if (!job) return null;
    job.status = "RUNNING";
    job.startedAt = new Date().toISOString();
    job.attempts += 1;
    try {
      const result = await handler(job);
      if (result === "ok") {
        job.status = "COMPLETED";
        job.finishedAt = new Date().toISOString();
      } else if (result === "ambiguous") {
        job.status = "AMBIGUOUS";
        job.finishedAt = new Date().toISOString();
        job.errorCode = "AMBIGUOUS";
      } else if (result === "retry" && job.attempts < job.maxAttempts) {
        job.status = "RETRY_SCHEDULED";
        job.scheduledAt = new Date(Date.now() + 1000).toISOString();
      } else {
        job.status = "DEAD_LETTER";
        job.errorCode = "MAX_ATTEMPTS";
        job.finishedAt = new Date().toISOString();
      }
    } catch (e) {
      job.status = "FAILED";
      job.errorCode = e instanceof Error ? e.message : "ERR";
      job.finishedAt = new Date().toISOString();
    }
    return job;
  }

  clear() {
    this.jobs.clear();
  }
}

export function hashRequestPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? {}))
    .digest("hex")
    .slice(0, 40);
}
