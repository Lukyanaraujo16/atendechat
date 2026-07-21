/**
 * Fase IA 2.1F — Evidence Engine (fatos observáveis; sem CoT / sem IA-judge).
 */

export const AUTOMATION_EVIDENCE_VERSION = "2.1.0-f";

export const EVIDENCE_COMPANY_THRESHOLDS_SETTING_KEY =
  "automationEvidenceThresholds";

export const EVIDENCE_TYPES = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "TOOL_UNUSED",
  "EMPTY_RESULT",
  "NO_TOOL_NEEDED",
  "TOOL_NOT_SELECTED",
  "INVALID_TOOL_SELECTION",
  "HALLUCINATION_AFTER_TOOL",
  "KNOWLEDGE_VERIFIED",
  "KNOWLEDGE_UNUSED",
  "MULTIPLE_TOOL_CONSISTENCY",
  "CONFLICTING_TOOL_RESULTS"
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const READINESS_LEVELS = [
  "NOT_READY",
  "EXPERIMENTAL",
  "LIMITED",
  "READY",
  "PRODUCTION"
] as const;

export type ReadinessLevel = (typeof READINESS_LEVELS)[number];

/** Thresholds padrão — editáveis via Setting (JSON). Sem pesos hardcoded no score. */
export const DEFAULT_EVIDENCE_THRESHOLDS = {
  weights: {
    verificationRate: 0.35,
    hallucinationRate: 0.25,
    toolFailureRate: 0.1,
    toolDeniedRate: 0.05,
    loopStopRate: 0.05,
    knowledgeUtilizationRate: 0.1,
    latencyNorm: 0.05,
    costNorm: 0.05
  },
  norms: {
    /** Latência acima disso contribui 0 para o fator latency. */
    maxLatencyMs: 8000,
    /** Custo médio USD acima disso contribui 0. */
    maxAverageCostUsd: 0.05
  },
  levels: {
    NOT_READY: { maxScore: 0.29 },
    EXPERIMENTAL: { minScore: 0.3, maxScore: 0.49 },
    LIMITED: { minScore: 0.5, maxScore: 0.69 },
    READY: {
      minScore: 0.7,
      maxScore: 0.84,
      minVerificationRate: 0.5,
      maxHallucinationRate: 0.15
    },
    PRODUCTION: {
      minScore: 0.85,
      minVerificationRate: 0.7,
      maxHallucinationRate: 0.05,
      maxToolFailureRate: 0.1,
      maxLoopStopRate: 0.1
    }
  },
  /** Mínimo de samples para readiness confiável. */
  minSamples: 10
} as const;

export type EvidenceThresholdsConfig = {
  weights: {
    verificationRate: number;
    hallucinationRate: number;
    toolFailureRate: number;
    toolDeniedRate: number;
    loopStopRate: number;
    knowledgeUtilizationRate: number;
    latencyNorm: number;
    costNorm: number;
  };
  norms: {
    maxLatencyMs: number;
    maxAverageCostUsd: number;
  };
  levels: {
    NOT_READY: { maxScore: number };
    EXPERIMENTAL: { minScore: number; maxScore: number };
    LIMITED: { minScore: number; maxScore: number };
    READY: {
      minScore: number;
      maxScore: number;
      minVerificationRate?: number;
      maxHallucinationRate?: number;
    };
    PRODUCTION: {
      minScore: number;
      minVerificationRate?: number;
      maxHallucinationRate?: number;
      maxToolFailureRate?: number;
      maxLoopStopRate?: number;
    };
  };
  minSamples: number;
};
