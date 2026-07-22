/**
 * Fase IA 2.2.1 — Hardening Live (produção em larga escala).
 * Sem novas capacidades de usuário.
 */

export const AUTOMATION_LIVE_HARDENING_VERSION = "2.2.1";

export const LIVE_HARDENING_SETTING_KEY = "automationLiveHardening";

export const CIRCUIT_STATES = ["Closed", "Open", "HalfOpen"] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];

export const DEFAULT_LIVE_HARDENING_CONFIG = {
  circuitBreaker: {
    failureThreshold: 5,
    failureWindowMs: 60_000,
    openTtlMs: 60_000,
    halfOpenMaxProbes: 1
  },
  rateLimit: {
    companyPerMinute: 120,
    connectionPerMinute: 60,
    agentPerMinute: 60,
    providerPerMinute: 200,
    toolPerMinute: 40
  },
  rollbackGuard: {
    cooldownMs: 30 * 60_000,
    minIntervalMs: 10 * 60_000
  },
  promotionGuard: {
    minExecutions: 50,
    minEvidenceSamples: 20,
    minVerificationRate: 0.5,
    maxHallucinationRate: 0.1,
    minReadinessScore: 0.5
  },
  sampleWindow: {
    windowMs: 60 * 60_000,
    maxSamples: 5000
  },
  retention: {
    evidenceDays: 90,
    runtimeLogDays: 60,
    metricsDays: 30,
    alertDays: 30
  },
  alerts: {
    latencyMs: 12_000,
    fallbackRate: 0.35,
    toolFailureRate: 0.25,
    rollbackCountHour: 3
  }
} as const;

export type LiveHardeningConfig = {
  circuitBreaker: {
    failureThreshold: number;
    failureWindowMs: number;
    openTtlMs: number;
    halfOpenMaxProbes: number;
  };
  rateLimit: {
    companyPerMinute: number;
    connectionPerMinute: number;
    agentPerMinute: number;
    providerPerMinute: number;
    toolPerMinute: number;
  };
  rollbackGuard: {
    cooldownMs: number;
    minIntervalMs: number;
  };
  promotionGuard: {
    minExecutions: number;
    minEvidenceSamples: number;
    minVerificationRate: number;
    maxHallucinationRate: number;
    minReadinessScore: number;
  };
  sampleWindow: {
    windowMs: number;
    maxSamples: number;
  };
  retention: {
    evidenceDays: number;
    runtimeLogDays: number;
    metricsDays: number;
    alertDays: number;
  };
  alerts: {
    latencyMs: number;
    fallbackRate: number;
    toolFailureRate: number;
    rollbackCountHour: number;
  };
};
