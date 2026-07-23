import {
  AgentOsCapability,
  CapabilityDecision,
  DEFAULT_AGENTOS_PRODUCTION_FLAGS
} from "../../../config/automationAgentOsProductionConstants";
import { loadRolloutConfig } from "./RolloutStateMachine";
import { resolveKillSwitch } from "./KillSwitchService";
import { AUTOMATION_AGENTOS_VERSION } from "../../../config/automationAgentOsProductionConstants";

/**
 * Capability gate — nunca uma flag genérica libera tudo.
 */
export async function evaluateCapability(input: {
  companyId: number;
  capability: AgentOsCapability;
  agentId?: string | null;
  sessionId?: string | null;
  toolId?: string;
  mcpServerId?: string;
  mcpToolId?: string;
  providerId?: string;
  whatsappId?: number;
  queueId?: number;
}): Promise<CapabilityDecision> {
  const warnings: string[] = [];
  const cfg = await loadRolloutConfig(input.companyId);
  const flags = { ...DEFAULT_AGENTOS_PRODUCTION_FLAGS, ...cfg.flags };

  const base = (
    allowed: boolean,
    reasonCode: string
  ): CapabilityDecision => ({
    allowed,
    reasonCode,
    rolloutState: cfg.rolloutState,
    companyId: input.companyId,
    agentId: input.agentId ?? null,
    sessionId: input.sessionId ?? null,
    capability: input.capability,
    policyVersion: AUTOMATION_AGENTOS_VERSION,
    limitsApplied: {
      maxExecutionsPerMinute: cfg.maxExecutionsPerMinute,
      maxConcurrentExecutions: cfg.maxConcurrentExecutions
    },
    warnings,
    timestamp: new Date().toISOString()
  });

  const kill = await resolveKillSwitch({
    companyId: input.companyId,
    component: "agentos",
    providerId: input.providerId,
    agentId: input.agentId || undefined,
    whatsappId: input.whatsappId,
    queueId: input.queueId,
    toolId: input.toolId,
    mcpServerId: input.mcpServerId,
    mcpToolId: input.mcpToolId,
    sessionId: input.sessionId || undefined
  });
  if (kill.denied) return base(false, kill.reasonCode);

  if (cfg.rolloutState === "DISABLED") {
    if (
      input.capability === "admin_operations" ||
      input.capability === "replay" ||
      input.capability === "tester"
    ) {
      return base(true, "DISABLED_ADMIN_READ_OK");
    }
    return base(false, "ROLLOUT_DISABLED");
  }

  if (cfg.rolloutState === "SUSPENDED" || cfg.rolloutState === "ROLLBACK") {
    if (input.capability === "admin_operations") {
      return base(true, "SUSPENDED_ADMIN_OK");
    }
    return base(false, `ROLLOUT_${cfg.rolloutState}`);
  }

  if (cfg.disabledCapabilities.includes(input.capability)) {
    return base(false, "CAPABILITY_EXPLICITLY_DISABLED");
  }

  // Hard production defaults
  if (input.capability === "live_response" && flags.liveEnabled !== true) {
    return base(false, "LIVE_DISABLED_DEFAULT");
  }
  if (input.capability === "tool_write" && flags.toolWriteEnabled !== true) {
    return base(false, "TOOL_WRITE_DISABLED_DEFAULT");
  }
  if (input.capability === "mcp_write" && flags.mcpWriteEnabled !== true) {
    return base(false, "MCP_WRITE_DISABLED_DEFAULT");
  }
  if (input.capability === "coordinator" && flags.coordinatorLiveEnabled !== true) {
    return base(false, "COORDINATOR_LIVE_DISABLED");
  }

  if (input.capability === "multi_agent_routing") {
    if (
      cfg.rolloutState === "SHADOW" ||
      cfg.rolloutState === "INTERNAL_ONLY"
    ) {
      warnings.push("simulation_only");
      return base(true, "SHADOW_ROUTING_OK");
    }
    if (flags.multiAgentLiveEnabled !== true) {
      return base(false, "MULTI_AGENT_LIVE_DISABLED");
    }
  }

  if (
    (input.capability === "delegation" || input.capability === "handoff") &&
    flags.multiAgentLiveEnabled !== true
  ) {
    return base(false, "MULTI_AGENT_LIVE_DISABLED");
  }

  if (cfg.rolloutState === "SHADOW") {
    if (
      input.capability === "live_response" ||
      input.capability === "tool_write" ||
      input.capability === "mcp_write"
    ) {
      return base(false, "SHADOW_NO_WRITE_NO_LIVE");
    }
  }

  if (
    cfg.rolloutState === "TENANT_ALLOWLIST" ||
    cfg.rolloutState === "CANARY" ||
    cfg.rolloutState === "CONTROLLED_PRODUCTION"
  ) {
    if (
      input.agentId &&
      cfg.allowedAgentIds.length > 0 &&
      !cfg.allowedAgentIds.includes(input.agentId)
    ) {
      return base(false, "AGENT_NOT_ALLOWLISTED");
    }
    if (
      input.toolId &&
      cfg.allowedToolIds.length > 0 &&
      !cfg.allowedToolIds.includes(input.toolId)
    ) {
      return base(false, "TOOL_NOT_ALLOWLISTED");
    }
    if (
      input.mcpServerId &&
      cfg.allowedMcpServerIds.length > 0 &&
      !cfg.allowedMcpServerIds.includes(input.mcpServerId)
    ) {
      return base(false, "MCP_SERVER_NOT_ALLOWLISTED");
    }
  }

  if (
    cfg.enabledCapabilities.length > 0 &&
    !cfg.enabledCapabilities.includes(input.capability) &&
    input.capability !== "admin_operations"
  ) {
    // shadow_inference always ok in shadow+
    if (
      input.capability === "shadow_inference" &&
      ["INTERNAL_ONLY", "SHADOW", "TENANT_ALLOWLIST", "CANARY", "CONTROLLED_PRODUCTION"].includes(
        cfg.rolloutState
      )
    ) {
      return base(true, "SHADOW_INFERENCE_OK");
    }
    return base(false, "CAPABILITY_NOT_ENABLED");
  }

  return base(true, "CAPABILITY_ALLOWED");
}

/** Live response gate — checklist completo, default deny. */
export async function evaluateLiveResponseGate(input: {
  companyId: number;
  agentId?: string | null;
  sessionId?: string | null;
  whatsappId?: number;
  queueId?: number;
}): Promise<CapabilityDecision> {
  return evaluateCapability({
    ...input,
    capability: "live_response"
  });
}
