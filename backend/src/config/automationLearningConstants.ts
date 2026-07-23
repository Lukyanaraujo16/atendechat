/**
 * AI Agent V2.8 — Learning Engine.
 * Observar → Analisar → Candidato → Avaliar → Aprovar → Promover (shadow) → Monitorar.
 * Sem Live, sem auto-promotion, sem alteração de Planner/Runtime real.
 */

export const AUTOMATION_LEARNING_VERSION = "2.8.0";
export const AUTOMATION_LEARNING_FEATURE_KEY = "automation.learning";

export const LEARNING_MODES = [
  "MANUAL",
  "SCHEDULED_ANALYSIS",
  "POST_EXECUTION",
  "POST_EXECUTION_SIMULATED",
  "SHADOW",
  "PRODUCTION"
] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export const LEARNING_SCOPE_TYPES = [
  "SESSION",
  "GOAL",
  "AGENT",
  "TENANT",
  "CAPABILITY",
  "STRATEGY",
  "TOOL",
  "MCP_TOOL"
] as const;
export type LearningScopeType = (typeof LEARNING_SCOPE_TYPES)[number];

export const LEARNING_EVIDENCE_SOURCE_TYPES = [
  "PLAN",
  "EVALUATION",
  "SESSION",
  "ACTION",
  "RUNTIME",
  "MCP",
  "FEEDBACK",
  "MEMORY",
  "HUMAN_REVIEW",
  "METRIC"
] as const;
export type LearningEvidenceSourceType =
  (typeof LEARNING_EVIDENCE_SOURCE_TYPES)[number];

export const LEARNING_DATA_QUALITY_LEVELS = [
  "INSUFFICIENT",
  "LOW",
  "MEDIUM",
  "HIGH"
] as const;
export type LearningDataQualityLevel =
  (typeof LEARNING_DATA_QUALITY_LEVELS)[number];

export const LEARNING_PATTERN_TYPES = [
  "RECURRING_FAILURE",
  "SUCCESSFUL_STRATEGY",
  "INEFFICIENT_PLAN",
  "REDUNDANT_STEP",
  "FREQUENT_RECOVERY",
  "FREQUENT_REPLAN",
  "HUMAN_INTERVENTION_PATTERN",
  "CAPABILITY_SELECTION_PATTERN",
  "RUNTIME_SELECTION_PATTERN",
  "MCP_FAILURE_PATTERN",
  "TOOL_FAILURE_PATTERN",
  "CONFIRMATION_PATTERN",
  "LATENCY_PATTERN",
  "COST_PATTERN",
  "MISSING_PRECONDITION",
  "MISSING_POSTCONDITION",
  "INVALID_ARGUMENT_PATTERN",
  "KNOWLEDGE_GAP",
  "POLICY_DENIAL_PATTERN",
  "IDEMPOTENCY_PATTERN",
  "FALLBACK_PATTERN"
] as const;
export type LearningPatternType = (typeof LEARNING_PATTERN_TYPES)[number];

export const LEARNING_SEVERITIES = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
] as const;
export type LearningSeverity = (typeof LEARNING_SEVERITIES)[number];

export const LEARNING_CANDIDATE_TYPES = [
  "RUNTIME_PREFERENCE",
  "STRATEGY_PREFERENCE",
  "PROCEDURAL_KNOWLEDGE",
  "PRECONDITION_RECOMMENDATION",
  "POSTCONDITION_RECOMMENDATION",
  "RECOVERY_RECOMMENDATION",
  "CONFIRMATION_RECOMMENDATION",
  "TIMEOUT_RECOMMENDATION",
  "RETRY_RECOMMENDATION",
  "CAPABILITY_MAPPING_RECOMMENDATION",
  "TOOL_CONFIGURATION_RECOMMENDATION",
  "MCP_CONFIGURATION_RECOMMENDATION",
  "PLANNER_GUIDANCE",
  "POLICY_RECOMMENDATION",
  "KNOWLEDGE_GAP",
  "ALERT_ONLY"
] as const;
export type LearningCandidateType = (typeof LEARNING_CANDIDATE_TYPES)[number];

export const LEARNING_CANDIDATE_STATUSES = [
  "DRAFT",
  "EVALUATING",
  "READY_FOR_REVIEW",
  "APPROVED",
  "REJECTED",
  "PROMOTED",
  "ROLLED_BACK",
  "EXPIRED",
  "INVALIDATED"
] as const;
export type LearningCandidateStatus =
  (typeof LEARNING_CANDIDATE_STATUSES)[number];

export const LEARNING_EVALUATION_DECISIONS = [
  "INSUFFICIENT_DATA",
  "REJECTED",
  "REQUIRES_MORE_OBSERVATION",
  "READY_FOR_REVIEW",
  "REQUIRES_ADMIN_APPROVAL",
  "REQUIRES_SUPERADMIN_APPROVAL",
  "SAFE_FOR_SHADOW"
] as const;
export type LearningEvaluationDecision =
  (typeof LEARNING_EVALUATION_DECISIONS)[number];

export const LEARNING_PROMOTION_MODES = [
  "OBSERVE_ONLY",
  "SHADOW",
  "ADMIN_APPROVED",
  "SUPERADMIN_APPROVED",
  "AUTO_SAFE"
] as const;
export type LearningPromotionMode = (typeof LEARNING_PROMOTION_MODES)[number];

export const LEARNING_ARTIFACT_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "SUPERSEDED",
  "ROLLED_BACK",
  "EXPIRED"
] as const;
export type LearningArtifactStatus =
  (typeof LEARNING_ARTIFACT_STATUSES)[number];

export const HUMAN_FEEDBACK_CLASSIFICATIONS = [
  "CORRECT",
  "INCORRECT",
  "PARTIAL",
  "UNSAFE",
  "IRRELEVANT",
  "USEFUL",
  "NEEDS_IMPROVEMENT"
] as const;
export type HumanFeedbackClassification =
  (typeof HUMAN_FEEDBACK_CLASSIFICATIONS)[number];

export const LEARNING_EVENTS = [
  "LEARNING_ANALYSIS_STARTED",
  "LEARNING_ANALYSIS_COMPLETED",
  "LEARNING_DATASET_CREATED",
  "LEARNING_PATTERN_DETECTED",
  "LEARNING_CANDIDATE_CREATED",
  "LEARNING_CANDIDATE_UPDATED",
  "LEARNING_CANDIDATE_EVALUATED",
  "LEARNING_CANDIDATE_APPROVED",
  "LEARNING_CANDIDATE_REJECTED",
  "LEARNING_CANDIDATE_PROMOTED",
  "LEARNING_CANDIDATE_INVALIDATED",
  "LEARNING_ARTIFACT_CREATED",
  "LEARNING_ARTIFACT_ACTIVATED",
  "LEARNING_ARTIFACT_ROLLED_BACK",
  "LEARNING_HUMAN_FEEDBACK_ADDED",
  "LEARNING_CONFLICT_DETECTED",
  "LEARNING_SHADOW_APPLIED"
] as const;
export type LearningEventName = (typeof LEARNING_EVENTS)[number];

export const LEARNING_PERMISSIONS = [
  "automation.learning.view",
  "automation.learning.analyze",
  "automation.learning.reviewCandidates",
  "automation.learning.approveLowRisk",
  "automation.learning.approveHighRisk",
  "automation.learning.promoteShadow",
  "automation.learning.rollback",
  "automation.learning.addHumanFeedback",
  "automation.learning.viewAudit",
  "automation.learning.manageConfig"
] as const;

export const DEFAULT_LEARNING_CONFIG = {
  enabled: true,
  analysisMode: "MANUAL" as LearningMode,
  postExecutionAnalysisEnabled: false,
  scheduledAnalysisEnabled: false,
  minimumSampleSize: 3,
  minimumDataQuality: 0.4,
  minimumConfidence: 0.45,
  minimumPromotionConfidence: 0.65,
  maximumPromotionRisk: 0.55,
  humanApprovalRequired: true,
  superadminApprovalForHighRisk: true,
  autoPromotionEnabled: false,
  shadowEnabled: true,
  maximumCandidatesPerAnalysis: 20,
  candidateExpirationDays: 30,
  artifactExpirationDays: 90,
  temporalDecayEnabled: true,
  temporalDecayRate: 0.02,
  deduplicationWindowDays: 14,
  minimumHumanFeedbackCount: 0,
  patternThresholds: {
    recurringFailureRate: 0.35,
    recurringFailureMinOccurrences: 3,
    successfulStrategyRate: 0.7,
    recoveryRate: 0.3,
    replanRate: 0.25,
    humanInterventionRate: 0.2,
    mcpFailureRate: 0.3,
    toolFailureRate: 0.3,
    latencyMs: 5000,
    policyDenialRate: 0.2,
    fallbackRate: 0.25
  },
  riskThresholds: {
    low: 0.3,
    medium: 0.55,
    high: 0.75
  },
  impactThresholds: {
    low: 0.3,
    medium: 0.55,
    high: 0.75
  },
  qualityWeights: {
    sampleSize: 0.25,
    completeness: 0.2,
    consistency: 0.15,
    diversity: 0.1,
    recency: 0.1,
    knownOutcomes: 0.1,
    humanReview: 0.05,
    tenantIsolation: 0.05
  },
  confidenceWeights: {
    sampleSize: 0.3,
    successClarity: 0.25,
    evidenceWeight: 0.25,
    humanFeedback: 0.2
  },
  allowedCandidateTypes: [...LEARNING_CANDIDATE_TYPES] as LearningCandidateType[],
  allowedPromotionModes: [
    "OBSERVE_ONLY",
    "SHADOW",
    "ADMIN_APPROVED",
    "SUPERADMIN_APPROVED"
  ] as LearningPromotionMode[],
  logRetentionDays: 30,
  auditPayloadLimit: 4000,
  maxSamplesPerAnalysis: 200,
  maxAnalysisWindowDays: 90,
  liveIntegrationEnabled: false as const,
  productionPromotionEnabled: false as const,
  usesGenerativeAi: false as const
};

export type AutomationLearningConfig = {
  enabled: boolean;
  analysisMode: LearningMode;
  postExecutionAnalysisEnabled: boolean;
  scheduledAnalysisEnabled: boolean;
  minimumSampleSize: number;
  minimumDataQuality: number;
  minimumConfidence: number;
  minimumPromotionConfidence: number;
  maximumPromotionRisk: number;
  humanApprovalRequired: boolean;
  superadminApprovalForHighRisk: boolean;
  autoPromotionEnabled: false;
  shadowEnabled: boolean;
  maximumCandidatesPerAnalysis: number;
  candidateExpirationDays: number;
  artifactExpirationDays: number;
  temporalDecayEnabled: boolean;
  temporalDecayRate: number;
  deduplicationWindowDays: number;
  minimumHumanFeedbackCount: number;
  patternThresholds: typeof DEFAULT_LEARNING_CONFIG.patternThresholds;
  riskThresholds: typeof DEFAULT_LEARNING_CONFIG.riskThresholds;
  impactThresholds: typeof DEFAULT_LEARNING_CONFIG.impactThresholds;
  qualityWeights: typeof DEFAULT_LEARNING_CONFIG.qualityWeights;
  confidenceWeights: typeof DEFAULT_LEARNING_CONFIG.confidenceWeights;
  allowedCandidateTypes: LearningCandidateType[];
  allowedPromotionModes: LearningPromotionMode[];
  logRetentionDays: number;
  auditPayloadLimit: number;
  maxSamplesPerAnalysis: number;
  maxAnalysisWindowDays: number;
  liveIntegrationEnabled: false;
  productionPromotionEnabled: false;
  usesGenerativeAi: false;
};
