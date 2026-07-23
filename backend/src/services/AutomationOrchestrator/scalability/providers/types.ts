import { AgentOsIdempotencyStatus, AgentOsJobStatus } from "../../../../config/automationAgentOsScalabilityConstants";

export interface AgentOsCacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPrefix(prefix: string): Promise<number>;
}

export interface AgentOsDistributedLockProvider {
  acquire(
    key: string,
    ownerToken: string,
    ttlMs: number
  ): Promise<{ acquired: boolean; unavailable: boolean }>;
  release(key: string, ownerToken: string): Promise<boolean>;
  extend(key: string, ownerToken: string, ttlMs: number): Promise<boolean>;
}

export interface AgentOsRateLimitProvider {
  take(input: {
    scope: string;
    key: string;
    windowMs: number;
    max: number;
  }): Promise<{ allowed: boolean; remaining: number; unavailable: boolean }>;
}

export type AgentOsIdempotencyRecord = {
  key: string;
  companyId: number;
  operationType: string;
  requestHash: string;
  status: AgentOsIdempotencyStatus;
  ownerId: string;
  resultReference: string | null;
  errorCode: string | null;
  attemptCount: number;
  lockedUntil: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export interface AgentOsIdempotencyProvider {
  claim(input: {
    companyId: number;
    key: string;
    operationType: string;
    requestHash: string;
    ownerId: string;
    ttlMs: number;
    processingTimeoutMs: number;
  }): Promise<
    | { outcome: "acquired"; record: AgentOsIdempotencyRecord }
    | { outcome: "replay"; record: AgentOsIdempotencyRecord }
    | { outcome: "conflict_payload"; record: AgentOsIdempotencyRecord }
    | { outcome: "in_progress"; record: AgentOsIdempotencyRecord }
    | { outcome: "ambiguous"; record: AgentOsIdempotencyRecord }
  >;
  complete(input: {
    companyId: number;
    key: string;
    resultReference: string;
    ownerId: string;
  }): Promise<void>;
  fail(input: {
    companyId: number;
    key: string;
    ownerId: string;
    errorCode: string;
    final: boolean;
  }): Promise<void>;
  markAmbiguous(input: {
    companyId: number;
    key: string;
    ownerId: string;
    errorCode: string;
  }): Promise<void>;
}

export type AgentOsJobRecord = {
  jobId: string;
  companyId: number | null;
  type: string;
  payload: Record<string, unknown>;
  status: AgentOsJobStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  correlationId: string | null;
  deduplicationKey: string | null;
};

export interface AgentOsQueueProvider {
  enqueue(input: {
    type: string;
    companyId?: number | null;
    payload: Record<string, unknown>;
    correlationId?: string | null;
    deduplicationKey?: string | null;
    delayMs?: number;
    maxAttempts?: number;
  }): Promise<AgentOsJobRecord>;
  getJob(jobId: string): Promise<AgentOsJobRecord | null>;
  listJobs(opts?: {
    companyId?: number;
    status?: AgentOsJobStatus;
    limit?: number;
  }): Promise<AgentOsJobRecord[]>;
  markDeadLetter(jobId: string, errorCode: string): Promise<void>;
  requeue(jobId: string): Promise<AgentOsJobRecord | null>;
}
