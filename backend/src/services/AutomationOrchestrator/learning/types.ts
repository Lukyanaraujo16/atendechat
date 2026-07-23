import {
  AUTOMATION_LEARNING_VERSION,
  HumanFeedbackClassification,
  LearningArtifactStatus,
  LearningCandidateStatus,
  LearningCandidateType,
  LearningDataQualityLevel,
  LearningEvaluationDecision,
  LearningEvidenceSourceType,
  LearningEventName,
  LearningMode,
  LearningPatternType,
  LearningPromotionMode,
  LearningScopeType,
  LearningSeverity
} from "../../../config/automationLearningConstants";

export type LearningEvidence = {
  id: string;
  sourceType: LearningEvidenceSourceType;
  sourceId: string;
  eventType: string;
  timestamp: string;
  summary: string;
  structuredData: Record<string, unknown>;
  confidence: number;
  weight: number;
  tenantVerified: boolean;
  sanitized: boolean;
  metadata: Record<string, unknown>;
};

export type LearningDataQuality = {
  level: LearningDataQualityLevel;
  score: number;
  issues: string[];
  warnings: string[];
  usableForPromotion: boolean;
};

export type LearningDataset = {
  id: string;
  companyId: number;
  agentId: number | null;
  scopeType: LearningScopeType;
  scopeId: string;
  sourceSessionIds: string[];
  sourceGoalIds: string[];
  sourceExecutionIds: string[];
  periodStart: string;
  periodEnd: string;
  sampleSize: number;
  successCount: number;
  failureCount: number;
  partialCount: number;
  recoveryCount: number;
  replanCount: number;
  humanInterventionCount: number;
  evidence: LearningEvidence[];
  statistics: Record<string, unknown>;
  dataQuality: LearningDataQuality;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type LearningPattern = {
  id: string;
  companyId: number;
  agentId: number | null;
  patternType: LearningPatternType;
  scope: string;
  subject: string;
  occurrences: number;
  successRate: number;
  failureRate: number;
  averageLatency: number | null;
  averageCost: number | null;
  confidence: number;
  severity: LearningSeverity;
  firstObservedAt: string;
  lastObservedAt: string;
  evidenceIds: string[];
  conditions: Record<string, unknown>;
  observations: string[];
  recommendationHint: string;
  metadata: Record<string, unknown>;
};

export type LearningCandidate = {
  id: string;
  companyId: number;
  agentId: number | null;
  candidateType: LearningCandidateType;
  title: string;
  description: string;
  scope: string;
  target: string;
  proposedChange: Record<string, unknown>;
  currentState: Record<string, unknown>;
  expectedBenefit: string;
  possibleRisks: string[];
  evidenceIds: string[];
  patternIds: string[];
  sampleSize: number;
  confidence: number;
  impact: number;
  risk: number;
  reversibility: number;
  dataQuality: LearningDataQualityLevel;
  status: LearningCandidateStatus;
  createdBy: number | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  promotedAt: string | null;
  expiresAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type LearningEvaluationReport = {
  id: string;
  candidateId: string;
  decision: LearningEvaluationDecision;
  qualityScore: number;
  confidenceScore: number;
  riskScore: number;
  impactScore: number;
  reversibilityScore: number;
  evidenceScore: number;
  conflicts: string[];
  warnings: string[];
  reasonCodes: string[];
  requiredApprovals: string[];
  recommendedAction: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type LearningArtifact = {
  id: string;
  companyId: number;
  agentId: number | null;
  candidateId: string;
  artifactType: LearningCandidateType;
  scope: string;
  target: string;
  value: Record<string, unknown>;
  previousValue: Record<string, unknown> | null;
  status: LearningArtifactStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  version: number;
  promotionMode: LearningPromotionMode;
  approvedBy: number | null;
  promotedAt: string;
  rollbackAvailable: boolean;
  rollbackData: Record<string, unknown> | null;
  environment: "SHADOW" | "ADMIN_TEST" | "SIMULATION";
  knowledgeObjectId: string | null;
  metadata: Record<string, unknown>;
};

export type PlannerGuidance = {
  scope: string;
  goalType: string | null;
  recommendedPatterns: string[];
  avoidPatterns: string[];
  recommendedPreconditions: string[];
  recommendedPostconditions: string[];
  warnings: string[];
  confidence: number;
  sourceArtifactIds: string[];
};

export type RuntimeLearningGuidance = {
  capability: string;
  preferredRuntimeType: string | null;
  preferredAdapter: string | null;
  preferredServerId: string | null;
  preferredTool: string | null;
  avoidRuntimeTypes: string[];
  avoidServers: string[];
  avoidTools: string[];
  confidence: number;
  sourceArtifactIds: string[];
};

export type StrategyLearningGuidance = {
  capability: string;
  preferredStrategies: string[];
  avoidStrategies: string[];
  conditions: Record<string, unknown>;
  confidence: number;
  sourceArtifactIds: string[];
};

export type HumanLearningFeedback = {
  id: string;
  companyId: number;
  userId: number;
  agentId: number | null;
  sessionId: string | null;
  executionId: string | null;
  candidateId: string | null;
  rating: number;
  classification: HumanFeedbackClassification;
  comment: string;
  expectedOutcome: string | null;
  actualOutcome: string | null;
  approved: boolean;
  weight: number;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type LearningShadowComparison = {
  id: string;
  companyId: number;
  candidateId: string;
  artifactId: string | null;
  sourceExecutionId: string;
  originalDecision: Record<string, unknown>;
  shadowDecision: Record<string, unknown>;
  sameDecision: boolean;
  expectedImprovement: string | null;
  possibleRegression: string | null;
  confidence: number;
  evaluation: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type LearningAnalysis = {
  id: string;
  companyId: number;
  agentId: number | null;
  mode: LearningMode;
  scopeType: LearningScopeType;
  scopeId: string;
  datasetId: string | null;
  patternIds: string[];
  candidateIds: string[];
  status: "STARTED" | "COMPLETED" | "FAILED";
  startedAt: string;
  finishedAt: string | null;
  errorCode: string | null;
  metadata: Record<string, unknown>;
};

export type LearningAuditEntry = {
  id: string;
  companyId: number;
  agentId: number | null;
  userId: number | null;
  datasetId: string | null;
  patternId: string | null;
  candidateId: string | null;
  evaluationId: string | null;
  artifactId: string | null;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string;
  approvalMode: string | null;
  evidenceSummary: string;
  timestamp: string;
  metadataSanitized: Record<string, unknown>;
};

export type LearningEvent = {
  id: string;
  companyId: number;
  name: LearningEventName;
  subjectId: string | null;
  at: string;
  payload: Record<string, unknown>;
};

export type ExecutionHistorySample = {
  sessionId?: string;
  goalId?: string;
  executionId?: string;
  agentId?: number | null;
  capability?: string;
  runtimeType?: string;
  toolId?: string;
  mcpServerId?: string | null;
  mcpTool?: string | null;
  status?: "success" | "failure" | "partial";
  errorCode?: string | null;
  latencyMs?: number | null;
  cost?: number | null;
  recovery?: boolean;
  replan?: boolean;
  humanIntervention?: boolean;
  confirmationApproved?: boolean | null;
  fallbackUsed?: boolean;
  policyDenied?: boolean;
  planDecision?: string | null;
  skippedStep?: boolean;
  invalidArgument?: boolean;
  knowledgeGap?: boolean;
  strategy?: string | null;
  timestamp?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export { AUTOMATION_LEARNING_VERSION };
