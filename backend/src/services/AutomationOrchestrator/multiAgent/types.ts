import {
  AgentAvailabilityState,
  AgentHealthState,
  AgentMessageType,
  AgentRole,
  AgentSpecialization,
  AgentStatus,
  AUTOMATION_MULTI_AGENT_VERSION,
  ContextSharingLevel,
  DelegatedSessionStatus,
  DelegationExecutionMode,
  FallbackSafety,
  HandoffType,
  LoopDecision,
  MemoryScope,
  MultiAgentEventName,
  RoutingSourceType,
  SelectionStrategy
} from "../../../config/automationMultiAgentConstants";

export type {
  AgentAvailabilityState,
  AgentHealthState,
  AgentMessageType,
  AgentRole,
  AgentSpecialization,
  AgentStatus,
  ContextSharingLevel,
  DelegatedSessionStatus,
  DelegationExecutionMode,
  FallbackSafety,
  HandoffType,
  LoopDecision,
  MemoryScope,
  MultiAgentEventName,
  RoutingSourceType,
  SelectionStrategy
};

export type AgentMemoryPolicy = {
  workingMemoryEnabled: boolean;
  episodicMemoryEnabled: boolean;
  semanticMemoryEnabled: boolean;
  proceduralMemoryEnabled: boolean;
  reflectionMemoryEnabled: boolean;
  readOwnMemory: boolean;
  writeOwnMemory: boolean;
  readSharedTenantMemory: boolean;
  writeSharedTenantMemory: boolean;
  readContactMemory: boolean;
  writeContactMemory: boolean;
  readTicketMemory: boolean;
  writeTicketMemory: boolean;
  allowedMemoryTypes: string[];
  blockedTags: string[];
  retentionOverride: number | null;
  minimumConfidence: number;
  minimumImportance: number;
  metadata: Record<string, unknown>;
};

export type AgentLearningPolicy = {
  learningEnabled: boolean;
  observeExecutions: boolean;
  generateCandidates: boolean;
  allowShadowArtifacts: boolean;
  allowProceduralKnowledge: boolean;
  allowReflectionKnowledge: boolean;
  shareLearningWithinAgent: boolean;
  shareLearningWithinTenant: boolean;
  requireHumanApproval: boolean;
  minimumDataQuality: number;
  minimumConfidence: number;
  metadata: Record<string, unknown>;
};

export type AgentDelegationPolicy = {
  enabled: boolean;
  maxDepth: number;
  maxPerSession: number;
  requireConfirmation: boolean;
  allowedTargetRoles: AgentRole[];
  allowedSpecializations: AgentSpecialization[];
  defaultContextSharingLevel: ContextSharingLevel;
  metadata: Record<string, unknown>;
};

export type AgentHandoffPolicy = {
  enabled: boolean;
  maxPerSession: number;
  requireHumanApproval: boolean;
  preserveStickyAssignment: boolean;
  allowedHandoffTypes: HandoffType[];
  metadata: Record<string, unknown>;
};

export type AgentProfile = {
  id: string;
  companyId: number;
  name: string;
  slug: string;
  description: string;
  role: AgentRole;
  specialization: AgentSpecialization;
  status: AgentStatus;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  isCoordinator: boolean;
  isHumanSupervised: boolean;
  systemInstructions: string;
  businessInstructions: string;
  goalTypes: string[];
  capabilities: string[];
  allowedStrategyTypes: string[];
  allowedRuntimeTypes: string[];
  allowedToolIds: string[];
  blockedToolIds: string[];
  allowedMcpServerIds: string[];
  allowedMcpTools: string[];
  blockedMcpTools: string[];
  memoryPolicy: AgentMemoryPolicy;
  learningPolicy: AgentLearningPolicy;
  delegationPolicy: AgentDelegationPolicy;
  handoffPolicy: AgentHandoffPolicy;
  channelPolicy: { channels: string[]; whatsappIds: number[] };
  queueIds: number[];
  whatsappIds: number[];
  workingHours: { timezone: string; startHour: number; endHour: number } | null;
  language: string;
  provider: string | null;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  executionLimits: {
    maxConcurrentSessions: number;
    maxTokensPerSession: number | null;
  };
  version: number;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type AgentProfileVersion = {
  id: string;
  agentId: string;
  companyId: number;
  version: number;
  snapshot: AgentProfile;
  changeSummary: string;
  changedBy: number | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AgentCapabilityProfile = {
  agentId: string;
  capabilities: string[];
  preferredCapabilities: string[];
  blockedCapabilities: string[];
  capabilityPriorities: Record<string, number>;
  runtimePreferences: Record<string, string>;
  strategyPreferences: Record<string, string>;
  confidence: number;
  source: string;
  version: number;
  metadata: Record<string, unknown>;
};

export type AgentRoutingContext = {
  id: string;
  companyId: number;
  sourceType: RoutingSourceType;
  channel: string | null;
  whatsappId: number | null;
  queueId: number | null;
  ticketId: number | null;
  contactId: number | null;
  goalId: string | null;
  goalType: string | null;
  requiredCapabilities: string[];
  preferredSpecialization: AgentSpecialization | null;
  language: string | null;
  priority: number;
  currentAgentId: string | null;
  requestedAgentId: string | null;
  humanUserId: number | null;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type RejectedAgentCandidate = {
  agentId: string;
  reasonCodes: string[];
  missingCapabilities: string[];
  blockedCapabilities: string[];
  policyViolations: string[];
  availabilityState: AgentAvailabilityState;
  score: number;
  metadata: Record<string, unknown>;
};

export type AgentSelectionDecision = {
  id: string;
  companyId: number;
  routingContextId: string;
  selectedAgentId: string | null;
  selectedAgentVersion: number | null;
  candidateAgentIds: string[];
  rejectedCandidates: RejectedAgentCandidate[];
  selectionStrategy: SelectionStrategy | null;
  score: number;
  confidence: number;
  reasonCodes: string[];
  warnings: string[];
  fallbackAgentId: string | null;
  requiresHumanReview: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type SpecializedAgentContext = {
  companyId: number;
  agentId: string;
  agentVersion: number;
  agentRole: AgentRole;
  specialization: AgentSpecialization;
  instructions: string;
  allowedCapabilities: string[];
  allowedTools: string[];
  allowedMcpServers: string[];
  allowedMcpTools: string[];
  memoryPolicy: AgentMemoryPolicy;
  learningPolicy: AgentLearningPolicy;
  delegationPolicy: AgentDelegationPolicy;
  handoffPolicy: AgentHandoffPolicy;
  runtimePreferences: Record<string, string>;
  strategyPreferences: Record<string, string>;
  executionLimits: AgentProfile["executionLimits"];
  routingDecisionId: string | null;
  composedInstructionsSanitized: string;
  metadata: Record<string, unknown>;
};

export type MultiAgentSessionContext = {
  companyId: number;
  sessionId: string;
  rootSessionId: string;
  parentSessionId: string | null;
  agentId: string;
  agentVersion: number;
  supervisorAgentId: string | null;
  delegatedByAgentId: string | null;
  delegationDepth: number;
  handoffCount: number;
  routingDecisionId: string | null;
  contextBoundaryId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type AgentStickyAssignment = {
  id: string;
  companyId: number;
  scopeType: "contactId" | "ticketId" | "conversationId";
  scopeId: string;
  agentId: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  reason: string;
  metadata: Record<string, unknown>;
};

export type AgentContextBoundary = {
  id: string;
  companyId: number;
  sourceAgentId: string;
  targetAgentId: string;
  sourceSessionId: string;
  allowedFields: string[];
  blockedFields: string[];
  memoryScopes: MemoryScope[];
  knowledgeObjectIds: string[];
  ticketFields: string[];
  contactFields: string[];
  goalFields: string[];
  executionFields: string[];
  conversationWindow: number;
  sensitiveFieldsRemoved: string[];
  sanitizationApplied: boolean;
  sharingLevel: ContextSharingLevel;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
};

export type AgentDelegationRequest = {
  id: string;
  companyId: number;
  sourceAgentId: string;
  sourceSessionId: string;
  rootSessionId: string;
  requestedTargetAgentId: string | null;
  requiredSpecialization: AgentSpecialization | null;
  requiredCapabilities: string[];
  goal: string;
  task: string;
  expectedOutput: string;
  contextReferences: string[];
  allowedContextScopes: MemoryScope[];
  forbiddenContextScopes: MemoryScope[];
  priority: number;
  deadline: string | null;
  maxDepth: number;
  requiresConfirmation: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AgentDelegationPolicyDecision = {
  approved: boolean;
  executionMode: DelegationExecutionMode;
  requiresConfirmation: boolean;
  selectedTargetAgentId: string | null;
  allowedContextScopes: MemoryScope[];
  blockedContextScopes: MemoryScope[];
  effectiveMaxDepth: number;
  effectiveTimeout: number;
  violations: string[];
  warnings: string[];
  reasonCodes: string[];
  loopDecision: LoopDecision;
  metadata: Record<string, unknown>;
};

export type DelegatedExecutionSession = {
  id: string;
  companyId: number;
  rootSessionId: string;
  parentSessionId: string;
  sourceAgentId: string;
  targetAgentId: string;
  delegationRequestId: string;
  contextBoundaryId: string;
  goal: string;
  task: string;
  status: DelegatedSessionStatus;
  result: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  timeoutAt: string;
  metadata: Record<string, unknown>;
};

export type AgentDelegationResult = {
  id: string;
  companyId: number;
  delegationRequestId: string;
  sourceAgentId: string;
  targetAgentId: string;
  childSessionId: string;
  status: string;
  output: string;
  structuredResult: Record<string, unknown>;
  knowledgeObjects: string[];
  warnings: string[];
  errors: string[];
  confidence: number;
  adapterDecision:
    | "ACCEPT_RESULT"
    | "REQUEST_CLARIFICATION"
    | "RETRY_DELEGATION"
    | "SELECT_ANOTHER_AGENT"
    | "ESCALATE_TO_HUMAN"
    | "ABORT_DELEGATION";
  startedAt: string;
  completedAt: string;
  metadata: Record<string, unknown>;
};

export type AgentHandoffRequest = {
  id: string;
  companyId: number;
  sourceAgentId: string;
  sourceSessionId: string;
  requestedTargetAgentId: string | null;
  reason: string;
  reasonCode: string;
  goal: string;
  handoffType: HandoffType;
  contextSharingLevel: ContextSharingLevel;
  preserveStickyAssignment: boolean;
  requiresHumanApproval: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AgentHandoffResult = {
  id: string;
  companyId: number;
  sourceAgentId: string;
  targetAgentId: string;
  sourceSessionId: string;
  targetSessionId: string;
  handoffType: HandoffType;
  status: string;
  contextBoundaryId: string | null;
  stickyAssignmentUpdated: boolean;
  reasonCodes: string[];
  warnings: string[];
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AgentCoordinationTask = {
  id: string;
  title: string;
  description: string;
  requiredCapabilities: string[];
  preferredSpecialization: AgentSpecialization | null;
  assignedAgentId: string | null;
  dependencies: string[];
  contextSharingLevel: ContextSharingLevel;
  expectedOutput: string;
  status: string;
  metadata: Record<string, unknown>;
};

export type AgentCoordinationPlan = {
  id: string;
  companyId: number;
  coordinatorAgentId: string;
  rootGoalId: string;
  tasks: AgentCoordinationTask[];
  dependencies: string[];
  agentAssignments: Record<string, string>;
  parallelGroups: string[][];
  maxDelegationDepth: number;
  maxConcurrentAgents: number;
  estimatedCost: number | null;
  estimatedDuration: number | null;
  requiresApproval: boolean;
  status: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AgentMessage = {
  id: string;
  companyId: number;
  sourceAgentId: string;
  targetAgentId: string;
  sourceSessionId: string | null;
  targetSessionId: string | null;
  messageType: AgentMessageType;
  correlationId: string;
  payload: Record<string, unknown>;
  schemaVersion: string;
  requiresResponse: boolean;
  expiresAt: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AgentResultConflict = {
  id: string;
  companyId: number;
  coordinationPlanId: string;
  taskIds: string[];
  agentIds: string[];
  conflictType: string;
  description: string;
  results: Record<string, unknown>[];
  severity: string;
  recommendedResolution: string;
  requiresHumanReview: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AgentHumanInterventionRequest = {
  id: string;
  companyId: number;
  sessionId: string;
  agentId: string;
  reason: string;
  severity: string;
  requestedAction: string;
  contextSummary: string;
  assignedUserId: number | null;
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  metadata: Record<string, unknown>;
};

export type AgentHealthRecord = {
  agentId: string;
  companyId: number;
  status: AgentHealthState;
  availability: AgentAvailabilityState;
  activeSessions: number;
  failureRate: number;
  latencyMs: number | null;
  checkedAt: string;
  issues: string[];
  metadata: Record<string, unknown>;
};

export type MultiAgentEvent = {
  id: string;
  companyId: number;
  name: MultiAgentEventName;
  subjectId: string | null;
  at: string;
  payload: Record<string, unknown>;
};

export type MultiAgentAuditEntry = {
  id: string;
  companyId: number;
  userId: number | null;
  agentId: string | null;
  sourceAgentId: string | null;
  targetAgentId: string | null;
  agentVersion: number | null;
  rootSessionId: string | null;
  sessionId: string | null;
  childSessionId: string | null;
  routingDecisionId: string | null;
  delegationRequestId: string | null;
  handoffRequestId: string | null;
  coordinationPlanId: string | null;
  action: string;
  previousState: string | null;
  newState: string | null;
  reasonCodes: string[];
  contextBoundarySummary: string;
  approvalMode: string | null;
  timestamp: string;
  metadataSanitized: Record<string, unknown>;
};

export type FallbackEvaluation = {
  safety: FallbackSafety;
  fallbackAgentId: string | null;
  reasonCodes: string[];
};

export { AUTOMATION_MULTI_AGENT_VERSION };
