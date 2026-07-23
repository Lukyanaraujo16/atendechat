import { AgentProfile } from "../types";
import { getMultiAgentConfig } from "../MultiAgentConfig";
import { recordMultiAgentMetric } from "../metrics/MultiAgentMetrics";

export type AgentToolBoundary = {
  allowedTools: string[];
  blockedTools: string[];
  allowedCapabilities: string[];
  blockedCapabilities: string[];
  allowedMcpServers: string[];
  allowedMcpTools: string[];
  blockedMcpTools: string[];
  allowWrite: boolean;
  requireConfirmationForWrites: boolean;
  denials: string[];
};

/**
 * AgentToolBoundaryResolver — interseção sistema ∩ agente ∩ plano ∩ políticas.
 */
export function resolveAgentToolBoundary(input: {
  companyId: number;
  agent: AgentProfile;
  systemCapabilities?: string[];
  systemTools?: string[];
  planCapabilities?: string[];
}): AgentToolBoundary {
  const systemCaps = input.systemCapabilities || [
    "SEARCH_CONTACT",
    "SEARCH_KNOWLEDGE",
    "SEARCH_TICKET",
    "VALIDATE_CONTEXT",
    "TRANSFER_TICKET",
    "UPDATE_ENTITY",
    "SEND_MESSAGE",
    "CUSTOM_OPERATION"
  ];
  const planCaps = input.planCapabilities || systemCaps;
  const systemTools = input.systemTools || input.agent.allowedToolIds;

  const allowedCapabilities = input.agent.capabilities.length
    ? input.agent.capabilities.filter(
        c => systemCaps.includes(c) && planCaps.includes(c)
      )
    : systemCaps.filter(c => planCaps.includes(c));

  const blockedCapabilities: string[] = [];
  const denials: string[] = [];

  let allowedTools = input.agent.allowedToolIds.length
    ? input.agent.allowedToolIds.filter(
        t => !input.agent.blockedToolIds.includes(t)
      )
    : (systemTools || []).filter(t => !input.agent.blockedToolIds.includes(t));

  for (const t of input.agent.blockedToolIds) {
    if (allowedTools.includes(t)) {
      allowedTools = allowedTools.filter(x => x !== t);
      denials.push(`tool_blocked:${t}`);
      recordMultiAgentMetric("toolBoundaryDenials");
    }
  }

  const allowedMcpServers = [...input.agent.allowedMcpServerIds];
  const allowedMcpTools = input.agent.allowedMcpTools.filter(
    t => !input.agent.blockedMcpTools.includes(t)
  );
  for (const t of input.agent.blockedMcpTools) {
    denials.push(`mcp_tool_blocked:${t}`);
    recordMultiAgentMetric("mcpBoundaryDenials");
  }

  const cfg = getMultiAgentConfig(input.companyId);
  if (!cfg.enabled) denials.push("multi_agent_disabled");

  return {
    allowedTools,
    blockedTools: [...input.agent.blockedToolIds],
    allowedCapabilities,
    blockedCapabilities,
    allowedMcpServers,
    allowedMcpTools,
    blockedMcpTools: [...input.agent.blockedMcpTools],
    allowWrite: !input.agent.metadata?.readOnly,
    requireConfirmationForWrites: true,
    denials
  };
}

export function assertCapabilityAllowed(
  boundary: AgentToolBoundary,
  capability: string
): void {
  if (
    boundary.allowedCapabilities.length &&
    !boundary.allowedCapabilities.includes(capability)
  ) {
    recordMultiAgentMetric("toolBoundaryDenials");
    throw new Error("ERR_AGENT_CAPABILITY_NOT_ALLOWED");
  }
}

export function assertToolAllowed(
  boundary: AgentToolBoundary,
  toolId: string
): void {
  if (boundary.blockedTools.includes(toolId)) {
    recordMultiAgentMetric("toolBoundaryDenials");
    throw new Error("ERR_AGENT_TOOL_NOT_ALLOWED");
  }
  if (boundary.allowedTools.length && !boundary.allowedTools.includes(toolId)) {
    recordMultiAgentMetric("toolBoundaryDenials");
    throw new Error("ERR_AGENT_TOOL_NOT_ALLOWED");
  }
}

export function assertMcpAllowed(
  boundary: AgentToolBoundary,
  serverId: string,
  toolName?: string
): void {
  if (
    boundary.allowedMcpServers.length &&
    !boundary.allowedMcpServers.includes(serverId)
  ) {
    recordMultiAgentMetric("mcpBoundaryDenials");
    throw new Error("ERR_AGENT_MCP_NOT_ALLOWED");
  }
  if (toolName && boundary.blockedMcpTools.includes(toolName)) {
    recordMultiAgentMetric("mcpBoundaryDenials");
    throw new Error("ERR_AGENT_MCP_NOT_ALLOWED");
  }
  if (
    toolName &&
    boundary.allowedMcpTools.length &&
    !boundary.allowedMcpTools.includes(toolName)
  ) {
    recordMultiAgentMetric("mcpBoundaryDenials");
    throw new Error("ERR_AGENT_MCP_NOT_ALLOWED");
  }
}

export default {
  resolveAgentToolBoundary,
  assertCapabilityAllowed,
  assertToolAllowed,
  assertMcpAllowed
};
