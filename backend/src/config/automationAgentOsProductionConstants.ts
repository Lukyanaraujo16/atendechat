/**
 * AI Agent V2.10 Wave 5 — Production Readiness / Release Candidate.
 * Defaults: tudo desabilitado. Sem mudança cognitiva.
 */

export const AUTOMATION_AGENTOS_VERSION = "2.10.0-wave5";
export const AGENTOS_SCHEMA_VERSION = "2.10.5";
export const AGENTOS_API_VERSION = "v2.10";
export const AGENTOS_WORKER_VERSION = "2.10.5";
export const AGENTOS_JOB_PAYLOAD_VERSION = "1";

export const AGENTOS_ROLLOUT_STATES = [
  "DISABLED",
  "INTERNAL_ONLY",
  "SHADOW",
  "TENANT_ALLOWLIST",
  "CANARY",
  "CONTROLLED_PRODUCTION",
  "SUSPENDED",
  "ROLLBACK"
] as const;

export type AgentOsRolloutState = (typeof AGENTOS_ROLLOUT_STATES)[number];

/** Transições permitidas — saltos inseguros proibidos. */
export const AGENTOS_ROLLOUT_TRANSITIONS: Record<
  AgentOsRolloutState,
  AgentOsRolloutState[]
> = {
  DISABLED: ["INTERNAL_ONLY"],
  INTERNAL_ONLY: ["SHADOW", "DISABLED"],
  SHADOW: ["TENANT_ALLOWLIST", "INTERNAL_ONLY", "DISABLED"],
  TENANT_ALLOWLIST: ["CANARY", "SHADOW", "SUSPENDED"],
  CANARY: ["CONTROLLED_PRODUCTION", "TENANT_ALLOWLIST", "SUSPENDED", "ROLLBACK"],
  CONTROLLED_PRODUCTION: ["CANARY", "SUSPENDED", "ROLLBACK"],
  SUSPENDED: ["DISABLED", "SHADOW", "INTERNAL_ONLY", "TENANT_ALLOWLIST"],
  ROLLBACK: ["SHADOW", "DISABLED"]
};

export const AGENTOS_CAPABILITIES = [
  "shadow_inference",
  "live_response",
  "tool_read",
  "tool_write",
  "mcp_read",
  "mcp_write",
  "memory_read",
  "memory_write",
  "learning_observation",
  "learning_approval",
  "multi_agent_routing",
  "delegation",
  "handoff",
  "coordinator",
  "replay",
  "tester",
  "admin_operations"
] as const;

export type AgentOsCapability = (typeof AGENTOS_CAPABILITIES)[number];

export const AGENTOS_KILL_SWITCH_SCOPES = [
  "global",
  "component",
  "provider",
  "tenant",
  "agent",
  "whatsapp",
  "queue",
  "tool",
  "mcp_server",
  "mcp_tool",
  "session"
] as const;

export type AgentOsKillSwitchScope = (typeof AGENTOS_KILL_SWITCH_SCOPES)[number];

/** Defaults obrigatórios — nunca ligar Live por padrão. */
export const DEFAULT_AGENTOS_PRODUCTION_FLAGS = {
  globalEnabled: false,
  liveEnabled: false,
  multiAgentLiveEnabled: false,
  coordinatorLiveEnabled: false,
  learningAutoPromotionEnabled: false,
  mcpWriteEnabled: false,
  toolWriteEnabled: false,
  autoRollbackEnabled: false,
  defaultRolloutState: "DISABLED" as AgentOsRolloutState
};

export type AgentOsProductionFlags = {
  globalEnabled: boolean;
  liveEnabled: boolean;
  multiAgentLiveEnabled: boolean;
  coordinatorLiveEnabled: boolean;
  learningAutoPromotionEnabled: boolean;
  mcpWriteEnabled: boolean;
  toolWriteEnabled: boolean;
  autoRollbackEnabled: boolean;
  defaultRolloutState: AgentOsRolloutState;
};

export const AGENTOS_PRODUCTION_PERMISSIONS = [
  "automation.agentos.view",
  "automation.agentos.configure",
  "automation.agentos.rollout.view",
  "automation.agentos.rollout.manage",
  "automation.agentos.emergencyStop",
  "automation.agentos.health.view",
  "automation.agentos.health.detailed",
  "automation.agentos.audit.view",
  "automation.agentos.metrics.view",
  "automation.agentos.replay.view",
  "automation.agentos.replay.reprocess",
  "automation.agentos.jobs.view",
  "automation.agentos.jobs.reprocess",
  "automation.agentos.deadLetter.view",
  "automation.agentos.deadLetter.reprocess",
  "automation.agentos.cache.invalidate",
  "automation.agentos.cleanup.run",
  "automation.agentos.consistency.run",
  "automation.memory.view",
  "automation.memory.manage",
  "automation.learning.view",
  "automation.learning.approve",
  "automation.learning.promote",
  "automation.learning.rollback",
  "automation.mcp.view",
  "automation.mcp.manage",
  "automation.mcp.executeRead",
  "automation.mcp.executeWrite",
  "automation.agents.view",
  "automation.agents.manage",
  "automation.agents.activate",
  "automation.agents.suspend",
  "automation.agents.delegate",
  "automation.agents.handoff",
  "automation.tools.view",
  "automation.tools.manage",
  "automation.tools.executeRead",
  "automation.tools.executeWrite"
] as const;

export const AGENTOS_ROLLOUT_MODULE_KEY = "agentos.rollout";
export const AGENTOS_KILL_SWITCH_MODULE_KEY = "agentos.killSwitches";
export const AGENTOS_INCIDENT_MODULE_KEY = "agentos.incidents";
export const AGENTOS_RC_MODULE_KEY = "agentos.releaseCandidate";
export const AGENTOS_CHECKLIST_MODULE_KEY = "agentos.goLiveChecklist";

export type CapabilityDecision = {
  allowed: boolean;
  reasonCode: string;
  rolloutState: AgentOsRolloutState;
  companyId: number;
  agentId: string | null;
  sessionId: string | null;
  capability: AgentOsCapability;
  policyVersion: string;
  limitsApplied: Record<string, unknown>;
  warnings: string[];
  timestamp: string;
};

export type PreflightStatus = "PASS" | "PASS_WITH_WARNINGS" | "FAIL";
export type ReleaseStatus = "READY" | "READY_WITH_WARNINGS" | "NOT_READY" | "BLOCKED";
export type CanaryHealth = "HEALTHY" | "WARNING" | "UNHEALTHY" | "INSUFFICIENT_DATA";
export type CostLimitState = "WITHIN_LIMIT" | "SOFT_LIMIT" | "HARD_LIMIT" | "UNKNOWN";

export type AgentOsRolloutConfig = {
  companyId: number;
  rolloutState: AgentOsRolloutState;
  previousRolloutState: AgentOsRolloutState | null;
  enabledCapabilities: AgentOsCapability[];
  disabledCapabilities: AgentOsCapability[];
  allowedAgentIds: string[];
  allowedWhatsappIds: number[];
  allowedQueueIds: number[];
  allowedUserIds: number[];
  allowedToolIds: string[];
  allowedMcpServerIds: string[];
  allowedMcpToolIds: string[];
  allowedProviderIds: string[];
  maxExecutionsPerMinute: number;
  maxConcurrentExecutions: number;
  maxDailyExecutions: number;
  maxDailyCost: number | null;
  maxToolCallsPerExecution: number;
  maxMcpCallsPerExecution: number;
  maxDelegationDepth: number;
  shadowSamplingRate: number;
  canarySamplingRate: number;
  autoRollbackEnabled: boolean;
  autoRollbackPolicy: string[];
  maintenanceWindow: string | null;
  startsAt: string | null;
  endsAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  lastTransitionAt: string | null;
  lastTransitionBy: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  flags: AgentOsProductionFlags;
};

export function defaultRolloutConfig(companyId: number): AgentOsRolloutConfig {
  const now = new Date().toISOString();
  return {
    companyId,
    rolloutState: "DISABLED",
    previousRolloutState: null,
    enabledCapabilities: ["shadow_inference", "replay", "tester", "admin_operations"],
    disabledCapabilities: [
      "live_response",
      "tool_write",
      "mcp_write",
      "delegation",
      "handoff",
      "coordinator"
    ],
    allowedAgentIds: [],
    allowedWhatsappIds: [],
    allowedQueueIds: [],
    allowedUserIds: [],
    allowedToolIds: [],
    allowedMcpServerIds: [],
    allowedMcpToolIds: [],
    allowedProviderIds: [],
    maxExecutionsPerMinute: 10,
    maxConcurrentExecutions: 2,
    maxDailyExecutions: 100,
    maxDailyCost: null,
    maxToolCallsPerExecution: 5,
    maxMcpCallsPerExecution: 5,
    maxDelegationDepth: 1,
    shadowSamplingRate: 1,
    canarySamplingRate: 0.05,
    autoRollbackEnabled: false,
    autoRollbackPolicy: [
      "critical_alert",
      "ambiguous_write",
      "security_violation",
      "cross_tenant_violation"
    ],
    maintenanceWindow: null,
    startsAt: null,
    endsAt: null,
    suspendedAt: null,
    suspendedReason: null,
    lastTransitionAt: null,
    lastTransitionBy: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    flags: { ...DEFAULT_AGENTOS_PRODUCTION_FLAGS }
  };
}
