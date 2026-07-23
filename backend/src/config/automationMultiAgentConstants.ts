/**
 * AI Agent V2.9 — Multi-Agent Runtime.
 * Agentes = especializações configuráveis sobre o AgentOS compartilhado.
 * Live / delegação / handoff / coordinator reais desabilitados nesta fase.
 */

export const AUTOMATION_MULTI_AGENT_VERSION = "2.9.0";
export const AUTOMATION_MULTI_AGENT_FEATURE_KEY = "automation.multi_agent";

export const AGENT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "DEGRADED",
  "ARCHIVED"
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const AGENT_ROLES = [
  "SPECIALIST",
  "COORDINATOR",
  "SUPERVISOR",
  "ROUTER",
  "OBSERVER",
  "HUMAN_PROXY"
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_SPECIALIZATIONS = [
  "GENERAL",
  "SALES",
  "SUPPORT",
  "FINANCE",
  "BILLING",
  "SCHEDULING",
  "ADMINISTRATIVE",
  "RETENTION",
  "ONBOARDING",
  "CUSTOM"
] as const;
export type AgentSpecialization = (typeof AGENT_SPECIALIZATIONS)[number];

export const AGENT_AVAILABILITY_STATES = [
  "AVAILABLE",
  "BUSY",
  "AT_CAPACITY",
  "OUTSIDE_WORKING_HOURS",
  "DEGRADED",
  "SUSPENDED",
  "UNAVAILABLE",
  "UNKNOWN"
] as const;
export type AgentAvailabilityState = (typeof AGENT_AVAILABILITY_STATES)[number];

export const AGENT_HEALTH_STATES = [
  "HEALTHY",
  "DEGRADED",
  "UNHEALTHY",
  "UNKNOWN"
] as const;
export type AgentHealthState = (typeof AGENT_HEALTH_STATES)[number];

export const ROUTING_SOURCE_TYPES = [
  "INBOUND_MESSAGE",
  "GOAL_CREATION",
  "SESSION_CREATION",
  "DELEGATION",
  "HANDOFF",
  "ADMIN_SIMULATION",
  "REPLAY"
] as const;
export type RoutingSourceType = (typeof ROUTING_SOURCE_TYPES)[number];

export const SELECTION_STRATEGIES = [
  "EXPLICIT_AGENT",
  "STICKY_AGENT",
  "QUEUE_AGENT",
  "CHANNEL_AGENT",
  "CAPABILITY_MATCH",
  "SPECIALIZATION_MATCH",
  "PRIORITY",
  "DEFAULT_AGENT",
  "COORDINATOR",
  "FALLBACK"
] as const;
export type SelectionStrategy = (typeof SELECTION_STRATEGIES)[number];

export const CONTEXT_SHARING_LEVELS = [
  "MINIMAL",
  "TASK_ONLY",
  "GOAL_CONTEXT",
  "TICKET_CONTEXT",
  "CONTACT_CONTEXT",
  "SESSION_SUMMARY",
  "CUSTOM"
] as const;
export type ContextSharingLevel = (typeof CONTEXT_SHARING_LEVELS)[number];

export const MEMORY_SCOPES = [
  "AGENT_PRIVATE",
  "AGENT_SHARED",
  "TENANT_SHARED",
  "CONTACT_SCOPED",
  "TICKET_SCOPED",
  "EXECUTION_SCOPED"
] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export const DELEGATION_EXECUTION_MODES = [
  "PREVIEW",
  "SIMULATION",
  "SHADOW",
  "CONFIRMATION_REQUIRED",
  "ALLOWED",
  "BLOCKED"
] as const;
export type DelegationExecutionMode =
  (typeof DELEGATION_EXECUTION_MODES)[number];

export const HANDOFF_TYPES = [
  "FULL_HANDOFF",
  "CONTEXTUAL_HANDOFF",
  "ESCALATION",
  "RETURN_TO_PREVIOUS_AGENT",
  "HUMAN_HANDOFF"
] as const;
export type HandoffType = (typeof HANDOFF_TYPES)[number];

export const LOOP_DECISIONS = ["SAFE", "POSSIBLE_LOOP", "LOOP_DETECTED"] as const;
export type LoopDecision = (typeof LOOP_DECISIONS)[number];

export const FALLBACK_SAFETY = ["SAFE", "UNSAFE", "NOT_AVAILABLE"] as const;
export type FallbackSafety = (typeof FALLBACK_SAFETY)[number];

export const AGENT_MESSAGE_TYPES = [
  "TASK_REQUEST",
  "TASK_ACCEPTED",
  "TASK_REJECTED",
  "CONTEXT_REQUEST",
  "CONTEXT_RESPONSE",
  "RESULT",
  "CLARIFICATION_REQUEST",
  "CLARIFICATION_RESPONSE",
  "STATUS_UPDATE",
  "CANCEL_REQUEST",
  "ESCALATION_REQUEST",
  "HANDOFF_REQUEST",
  "HANDOFF_ACCEPTED",
  "HANDOFF_REJECTED"
] as const;
export type AgentMessageType = (typeof AGENT_MESSAGE_TYPES)[number];

export const DELEGATED_SESSION_STATUSES = [
  "CREATED",
  "READY",
  "RUNNING",
  "WAITING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
  "BLOCKED"
] as const;
export type DelegatedSessionStatus =
  (typeof DELEGATED_SESSION_STATUSES)[number];

export const MULTI_AGENT_EVENTS = [
  "AGENT_CREATED",
  "AGENT_UPDATED",
  "AGENT_ACTIVATED",
  "AGENT_DEACTIVATED",
  "AGENT_SUSPENDED",
  "AGENT_ARCHIVED",
  "AGENT_VERSION_CREATED",
  "AGENT_ROUTING_STARTED",
  "AGENT_ROUTING_COMPLETED",
  "AGENT_SELECTED",
  "AGENT_SELECTION_FAILED",
  "AGENT_CONTEXT_CREATED",
  "AGENT_SESSION_STARTED",
  "AGENT_SESSION_COMPLETED",
  "AGENT_DELEGATION_REQUESTED",
  "AGENT_DELEGATION_APPROVED",
  "AGENT_DELEGATION_BLOCKED",
  "AGENT_DELEGATION_STARTED",
  "AGENT_DELEGATION_COMPLETED",
  "AGENT_DELEGATION_FAILED",
  "AGENT_HANDOFF_REQUESTED",
  "AGENT_HANDOFF_APPROVED",
  "AGENT_HANDOFF_COMPLETED",
  "AGENT_HANDOFF_FAILED",
  "AGENT_LOOP_DETECTED",
  "AGENT_MESSAGE_SENT",
  "AGENT_MESSAGE_RECEIVED",
  "AGENT_COORDINATION_STARTED",
  "AGENT_COORDINATION_COMPLETED",
  "AGENT_RESULT_CONFLICT_DETECTED",
  "AGENT_HUMAN_INTERVENTION_REQUESTED",
  "AGENT_FAILURE_ISOLATED",
  "AGENT_FALLBACK_SELECTED",
  "AGENT_HEALTH_CHANGED"
] as const;
export type MultiAgentEventName = (typeof MULTI_AGENT_EVENTS)[number];

export const MULTI_AGENT_ERROR_CODES = [
  "ERR_AGENT_NOT_FOUND",
  "ERR_AGENT_DISABLED",
  "ERR_AGENT_INACTIVE",
  "ERR_AGENT_SUSPENDED",
  "ERR_AGENT_UNHEALTHY",
  "ERR_AGENT_TENANT_FORBIDDEN",
  "ERR_AGENT_PLAN_DISABLED",
  "ERR_AGENT_PERMISSION_DENIED",
  "ERR_AGENT_LIMIT_EXCEEDED",
  "ERR_AGENT_CAPABILITY_NOT_ALLOWED",
  "ERR_AGENT_TOOL_NOT_ALLOWED",
  "ERR_AGENT_MCP_NOT_ALLOWED",
  "ERR_AGENT_MEMORY_NOT_ALLOWED",
  "ERR_AGENT_NO_CANDIDATE",
  "ERR_AGENT_SELECTION_FAILED",
  "ERR_AGENT_ROUTING_TIMEOUT",
  "ERR_AGENT_AT_CAPACITY",
  "ERR_AGENT_OUTSIDE_WORKING_HOURS",
  "ERR_AGENT_DELEGATION_DISABLED",
  "ERR_AGENT_DELEGATION_BLOCKED",
  "ERR_AGENT_DELEGATION_DEPTH_EXCEEDED",
  "ERR_AGENT_DELEGATION_LIMIT_EXCEEDED",
  "ERR_AGENT_DELEGATION_LOOP",
  "ERR_AGENT_DELEGATION_TIMEOUT",
  "ERR_AGENT_HANDOFF_DISABLED",
  "ERR_AGENT_HANDOFF_BLOCKED",
  "ERR_AGENT_HANDOFF_LIMIT_EXCEEDED",
  "ERR_AGENT_HANDOFF_LOOP",
  "ERR_AGENT_HANDOFF_TIMEOUT",
  "ERR_AGENT_CONTEXT_FORBIDDEN",
  "ERR_AGENT_CONTEXT_INVALID",
  "ERR_AGENT_MESSAGE_INVALID",
  "ERR_AGENT_MESSAGE_EXPIRED",
  "ERR_AGENT_COORDINATION_DISABLED",
  "ERR_AGENT_RESULT_CONFLICT",
  "ERR_AGENT_HUMAN_INTERVENTION_REQUIRED",
  "ERR_AGENT_LIVE_NOT_ENABLED",
  "ERR_AGENT_SLUG_DUPLICATE"
] as const;
export type MultiAgentErrorCode = (typeof MULTI_AGENT_ERROR_CODES)[number];

export const MULTI_AGENT_PERMISSIONS = [
  "automation.agents.view",
  "automation.agents.create",
  "automation.agents.update",
  "automation.agents.activate",
  "automation.agents.suspend",
  "automation.agents.archive",
  "automation.agents.manageCapabilities",
  "automation.agents.manageTools",
  "automation.agents.manageMcp",
  "automation.agents.manageMemory",
  "automation.agents.manageLearning",
  "automation.agents.manageRouting",
  "automation.agents.manageDelegation",
  "automation.agents.manageHandoff",
  "automation.agents.simulate",
  "automation.agents.approveDelegation",
  "automation.agents.approveHandoff",
  "automation.agents.supervise",
  "automation.agents.resolveIntervention",
  "automation.agents.viewAudit",
  "automation.agents.manageConfig"
] as const;

export const DEFAULT_MULTI_AGENT_CONFIG = {
  enabled: true,
  liveIntegrationEnabled: false as const,
  routingEnabled: true,
  delegationEnabled: true,
  handoffEnabled: true,
  coordinationEnabled: true,
  humanSupervisionEnabled: true,
  stickyAssignmentEnabled: true,
  maxAgentsPerCompany: 50,
  maxActiveAgentsPerCompany: 20,
  maxCoordinatorAgents: 3,
  maxConcurrentSessionsPerAgent: 25,
  maxConcurrentAgentsPerCoordination: 5,
  maxDelegationDepth: 2,
  maxDelegationsPerSession: 5,
  maxChildSessionsPerSession: 5,
  maxHandoffsPerSession: 3,
  maxMessagesPerSession: 50,
  routingTimeoutMs: 5_000,
  delegationTimeoutMs: 30_000,
  handoffTimeoutMs: 15_000,
  childSessionTimeoutMs: 60_000,
  coordinationTimeoutMs: 60_000,
  messageTimeoutMs: 30_000,
  stickyAssignmentTtlMs: 7 * 86400000,
  defaultContextSharingLevel: "TASK_ONLY" as ContextSharingLevel,
  allowedContextSharingLevels: [
    "MINIMAL",
    "TASK_ONLY",
    "GOAL_CONTEXT",
    "TICKET_CONTEXT",
    "CONTACT_CONTEXT",
    "SESSION_SUMMARY",
    "CUSTOM"
  ] as ContextSharingLevel[],
  defaultSelectionStrategies: [
    "EXPLICIT_AGENT",
    "STICKY_AGENT",
    "QUEUE_AGENT",
    "CHANNEL_AGENT",
    "CAPABILITY_MATCH",
    "SPECIALIZATION_MATCH",
    "PRIORITY",
    "DEFAULT_AGENT",
    "COORDINATOR",
    "FALLBACK"
  ] as SelectionStrategy[],
  selectionWeights: {
    capability: 0.3,
    specialization: 0.2,
    channel: 0.1,
    queue: 0.1,
    language: 0.05,
    availability: 0.1,
    priority: 0.05,
    health: 0.05,
    sticky: 0.05
  },
  healthThresholds: {
    degradedFailureRate: 0.35,
    unhealthyFailureRate: 0.6
  },
  failureThresholds: {
    maxRecentFailures: 10
  },
  fallbackEnabled: true,
  loopDetectionEnabled: true,
  requireApprovalForDelegation: true,
  requireApprovalForHandoff: true,
  coordinatorSimulationOnly: true as const,
  delegationSimulationOnly: true as const,
  handoffSimulationOnly: true as const,
  auditRetentionDays: 30,
  auditPayloadLimit: 4000,
  usesGenerativeAiForSelection: false as const,
  continuousAutonomyEnabled: false as const
};

export type AutomationMultiAgentConfig = {
  enabled: boolean;
  liveIntegrationEnabled: false;
  routingEnabled: boolean;
  delegationEnabled: boolean;
  handoffEnabled: boolean;
  coordinationEnabled: boolean;
  humanSupervisionEnabled: boolean;
  stickyAssignmentEnabled: boolean;
  maxAgentsPerCompany: number;
  maxActiveAgentsPerCompany: number;
  maxCoordinatorAgents: number;
  maxConcurrentSessionsPerAgent: number;
  maxConcurrentAgentsPerCoordination: number;
  maxDelegationDepth: number;
  maxDelegationsPerSession: number;
  maxChildSessionsPerSession: number;
  maxHandoffsPerSession: number;
  maxMessagesPerSession: number;
  routingTimeoutMs: number;
  delegationTimeoutMs: number;
  handoffTimeoutMs: number;
  childSessionTimeoutMs: number;
  coordinationTimeoutMs: number;
  messageTimeoutMs: number;
  stickyAssignmentTtlMs: number;
  defaultContextSharingLevel: ContextSharingLevel;
  allowedContextSharingLevels: ContextSharingLevel[];
  defaultSelectionStrategies: SelectionStrategy[];
  selectionWeights: typeof DEFAULT_MULTI_AGENT_CONFIG.selectionWeights;
  healthThresholds: typeof DEFAULT_MULTI_AGENT_CONFIG.healthThresholds;
  failureThresholds: typeof DEFAULT_MULTI_AGENT_CONFIG.failureThresholds;
  fallbackEnabled: boolean;
  loopDetectionEnabled: boolean;
  requireApprovalForDelegation: boolean;
  requireApprovalForHandoff: boolean;
  coordinatorSimulationOnly: true;
  delegationSimulationOnly: true;
  handoffSimulationOnly: true;
  auditRetentionDays: number;
  auditPayloadLimit: number;
  usesGenerativeAiForSelection: false;
  continuousAutonomyEnabled: false;
};
