/**
 * AI Agent V2.6 — Cognitive Memory Engine.
 * Memória cognitiva via contratos. Sem embeddings / Vector DB / Provider LLM.
 */

export const AUTOMATION_COGNITIVE_MEMORY_VERSION = "2.6.0";

export const MEMORY_TYPES = [
  "WORKING",
  "EPISODIC",
  "SEMANTIC",
  "PROCEDURAL",
  "REFLECTION"
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_EVENTS = [
  "MEMORY_CREATED",
  "MEMORY_UPDATED",
  "MEMORY_DELETED",
  "MEMORY_RETRIEVED",
  "KNOWLEDGE_CREATED"
] as const;

export type MemoryEventName = (typeof MEMORY_EVENTS)[number];

export const MEMORY_SOURCES = [
  "execution_feedback",
  "manual",
  "system",
  "replay"
] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const DEFAULT_COGNITIVE_MEMORY_CONFIG = {
  retention: {
    workingTtlMs: 60 * 60 * 1000,
    episodicDays: 90,
    semanticDays: 365,
    proceduralDays: 365,
    reflectionDays: 180
  },
  scoring: {
    weightRecency: 0.25,
    weightImportance: 0.3,
    weightConfidence: 0.25,
    weightFrequency: 0.1,
    weightType: 0.1,
    typeBoost: {
      WORKING: 0.9,
      EPISODIC: 0.7,
      SEMANTIC: 0.85,
      PROCEDURAL: 0.8,
      REFLECTION: 0.75
    }
  },
  limits: {
    maxWorkingPerSession: 50,
    maxResultsPerQuery: 50,
    maxObjectsPerTenant: 5000
  },
  workingMemory: {
    enabled: true,
    persist: false
  },
  importance: {
    default: 0.5,
    fromRecovery: 0.7,
    fromReplan: 0.8,
    fromFailure: 0.75,
    fromSuccess: 0.55
  },
  storageProvider: "SQL" as const,
  vectorEnabled: false,
  usesEmbeddings: false
} as const;

export type CognitiveMemoryConfig = {
  retention: {
    workingTtlMs: number;
    episodicDays: number;
    semanticDays: number;
    proceduralDays: number;
    reflectionDays: number;
  };
  scoring: {
    weightRecency: number;
    weightImportance: number;
    weightConfidence: number;
    weightFrequency: number;
    weightType: number;
    typeBoost: Record<MemoryType, number>;
  };
  limits: {
    maxWorkingPerSession: number;
    maxResultsPerQuery: number;
    maxObjectsPerTenant: number;
  };
  workingMemory: {
    enabled: boolean;
    persist: boolean;
  };
  importance: {
    default: number;
    fromRecovery: number;
    fromReplan: number;
    fromFailure: number;
    fromSuccess: number;
  };
  storageProvider: "SQL" | "VECTOR" | "REDIS" | "HYBRID";
  vectorEnabled: false;
  usesEmbeddings: false;
};

export const COGNITIVE_MEMORY_SETTING_KEY = "automationCognitiveMemory";
