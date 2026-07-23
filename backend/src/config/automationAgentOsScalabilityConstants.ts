/**
 * AI Agent V2.10 Wave 4 — Escalabilidade multi-instância (sem mudança cognitiva).
 */

export const AUTOMATION_AGENTOS_SCALABILITY_VERSION = "2.10.0-wave4";

export type AgentOsStateClass =
  | "EPHEMERAL_LOCAL"
  | "EPHEMERAL_DISTRIBUTED"
  | "PERSISTENT_OPERATIONAL"
  | "PERSISTENT_AUDIT"
  | "PERSISTENT_COGNITIVE"
  | "DERIVED_CACHE";

export type AgentOsProviderMode = "memory" | "redis" | "auto";

export type AgentOsIdempotencyStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL"
  | "AMBIGUOUS"
  | "EXPIRED";

export type AgentOsJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "RETRY_SCHEDULED"
  | "COMPLETED"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELLED"
  | "TIMED_OUT"
  | "AMBIGUOUS";

export type AgentOsRetryClass =
  | "RETRYABLE"
  | "NON_RETRYABLE"
  | "AMBIGUOUS"
  | "AUTHORIZATION"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "DEPENDENCY_UNAVAILABLE"
  | "POLICY_BLOCKED";

export type AgentOsWriteClass =
  | "CRITICAL_SYNCHRONOUS"
  | "OPERATIONAL_ASYNC"
  | "OBSERVABILITY_ASYNC"
  | "BEST_EFFORT";

export const AGENTOS_JOB_TYPES = [
  "observability_write",
  "metrics_aggregation",
  "alerts_evaluation",
  "replay_rebuild",
  "document_reindex",
  "retention_cleanup",
  "idempotency_cleanup",
  "mcp_catalog_sync",
  "mcp_health_probe",
  "agent_health_calc",
  "learning_analysis",
  "export_generation",
  "timeline_compaction",
  "cache_invalidation",
  "consistency_validation"
] as const;

export type AgentOsJobType = (typeof AGENTOS_JOB_TYPES)[number];

export const DEFAULT_AGENTOS_SCALABILITY_CONFIG = {
  persistenceMode: (process.env.AGENTOS_PERSISTENCE || "sequelize") as string,
  cacheProvider: (process.env.AGENTOS_CACHE_PROVIDER || "auto") as AgentOsProviderMode,
  distributedLockProvider: (process.env.AGENTOS_LOCK_PROVIDER ||
    "auto") as AgentOsProviderMode,
  rateLimitProvider: (process.env.AGENTOS_RATELIMIT_PROVIDER ||
    "auto") as AgentOsProviderMode,
  idempotencyProvider: (process.env.AGENTOS_IDEMPOTENCY_PROVIDER ||
    "auto") as AgentOsProviderMode,
  queueProvider: (process.env.AGENTOS_QUEUE_PROVIDER || "auto") as AgentOsProviderMode,
  jobConcurrency: Number(process.env.AGENTOS_JOB_CONCURRENCY || 2),
  workerHeartbeatMs: Number(process.env.AGENTOS_WORKER_HEARTBEAT_MS || 15_000),
  workerStaleMs: Number(process.env.AGENTOS_WORKER_STALE_MS || 60_000),
  lockDefaultTtlMs: Number(process.env.AGENTOS_LOCK_TTL_MS || 30_000),
  sessionLeaseTtlMs: Number(process.env.AGENTOS_SESSION_LEASE_TTL_MS || 120_000),
  sessionHeartbeatMs: Number(process.env.AGENTOS_SESSION_HEARTBEAT_MS || 20_000),
  idempotencyTtlMs: Number(process.env.AGENTOS_IDEMPOTENCY_TTL_MS || 86_400_000),
  idempotencyProcessingTimeoutMs: Number(
    process.env.AGENTOS_IDEMPOTENCY_PROCESSING_TIMEOUT_MS || 120_000
  ),
  cacheTtlMs: Number(process.env.AGENTOS_CACHE_TTL_MS || 60_000),
  dashboardCacheTtlMs: Number(process.env.AGENTOS_DASHBOARD_CACHE_TTL_MS || 15_000),
  profileCacheTtlMs: Number(process.env.AGENTOS_PROFILE_CACHE_TTL_MS || 60_000),
  featureCacheTtlMs: Number(process.env.AGENTOS_FEATURE_CACHE_TTL_MS || 60_000),
  metricsBucketSizeMs: Number(process.env.AGENTOS_METRICS_BUCKET_MS || 60_000),
  metricsFlushIntervalMs: Number(process.env.AGENTOS_METRICS_FLUSH_MS || 10_000),
  alertEvaluationIntervalMs: Number(process.env.AGENTOS_ALERT_EVAL_MS || 30_000),
  cleanupIntervalMs: Number(process.env.AGENTOS_CLEANUP_INTERVAL_MS || 3_600_000),
  cleanupBatchSize: Number(process.env.AGENTOS_CLEANUP_BATCH || 200),
  defaultPageLimit: Number(process.env.AGENTOS_DEFAULT_PAGE_LIMIT || 50),
  maxPageLimit: Number(process.env.AGENTOS_MAX_PAGE_LIMIT || 200),
  exportBatchSize: Number(process.env.AGENTOS_EXPORT_BATCH || 500),
  exportExpirationMs: Number(process.env.AGENTOS_EXPORT_EXPIRATION_MS || 86_400_000),
  maxConcurrentExecutionsPerTenant: Number(
    process.env.AGENTOS_MAX_EXEC_PER_TENANT || 20
  ),
  maxConcurrentExecutionsPerAgent: Number(
    process.env.AGENTOS_MAX_EXEC_PER_AGENT || 5
  ),
  maxConcurrentCallsPerMcpServer: Number(
    process.env.AGENTOS_MAX_MCP_CONCURRENCY || 5
  ),
  maxConcurrentProviderCalls: Number(
    process.env.AGENTOS_MAX_PROVIDER_CONCURRENCY || 10
  ),
  circuitBreakerFailureThreshold: Number(
    process.env.AGENTOS_CB_FAILURE_THRESHOLD || 5
  ),
  circuitBreakerOpenMs: Number(process.env.AGENTOS_CB_OPEN_MS || 30_000),
  slowQueryMs: Number(process.env.AGENTOS_SLOW_QUERY_MS || 500),
  gracefulShutdownTimeoutMs: Number(
    process.env.AGENTOS_GRACEFUL_SHUTDOWN_MS || 20_000
  ),
  startupRecoveryEnabled:
    process.env.AGENTOS_STARTUP_RECOVERY !== "false",
  liveIntegrationAllowed: false,
  retention: {
    eventsDays: Number(process.env.AGENTOS_RETENTION_EVENTS_DAYS || 60),
    metricsDays: Number(process.env.AGENTOS_RETENTION_METRICS_DAYS || 180),
    timelinesDays: Number(process.env.AGENTOS_RETENTION_TIMELINES_DAYS || 30),
    auditsDays: Number(process.env.AGENTOS_RETENTION_AUDITS_DAYS || 90),
    replaysDays: Number(process.env.AGENTOS_RETENTION_REPLAYS_DAYS || 30),
    alertsDays: Number(process.env.AGENTOS_RETENTION_ALERTS_DAYS || 30),
    jobsDays: Number(process.env.AGENTOS_RETENTION_JOBS_DAYS || 14),
    deadLetterDays: Number(process.env.AGENTOS_RETENTION_DLQ_DAYS || 30),
    idempotencyDays: Number(process.env.AGENTOS_RETENTION_IDEMPOTENCY_DAYS || 7),
    exportsDays: Number(process.env.AGENTOS_RETENTION_EXPORTS_DAYS || 2)
  },
  retry: {
    maxAttempts: Number(process.env.AGENTOS_RETRY_MAX || 5),
    baseDelayMs: Number(process.env.AGENTOS_RETRY_BASE_MS || 1_000),
    maxDelayMs: Number(process.env.AGENTOS_RETRY_MAX_MS || 60_000)
  }
} as const;

export type AgentOsScalabilityConfig = typeof DEFAULT_AGENTOS_SCALABILITY_CONFIG;

export const ERR_AGENTOS_CONCURRENT_MODIFICATION =
  "ERR_AGENTOS_CONCURRENT_MODIFICATION";
