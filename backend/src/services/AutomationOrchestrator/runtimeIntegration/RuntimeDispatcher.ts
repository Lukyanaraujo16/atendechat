import { ActionType } from "../../../config/automationActionExecutionConstants";
import {
  RuntimeCapabilityKind,
  RuntimeType
} from "../../../config/automationRuntimeIntegrationConstants";
import { McpAdapterPreference } from "../../../config/automationMcpConstants";
import { toolIdToProviderFunctionName } from "../../../config/automationFunctionCallingConstants";
import { getMcpConfig } from "../mcp/McpConfig";
import { listMcpServers } from "../mcp/McpServerStore";
import { listMcpTools } from "../mcp/McpToolCatalog";
import {
  findMcpToolForCapability,
  mapMcpToolToCapability
} from "../mcp/McpCapabilityMapper";
import { evaluateFallbackSafety } from "../mcp/McpSafetyEvaluators";
import { RuntimeCapability, RuntimeExecutionRequest } from "./types";
import { RuntimeDispatchDecision } from "../mcp/types";

const CAPABILITY_TOOL: Partial<
  Record<string, { toolId: string; categories: string[] }>
> = {
  SEARCH_CONTACT: { toolId: "contact.search", categories: ["contact"] },
  SEARCH_CUSTOMER: { toolId: "contact.search", categories: ["contact"] },
  SEARCH_KNOWLEDGE: { toolId: "knowledge.search", categories: ["knowledge"] },
  SEARCH_TICKET: { toolId: "ticket.search", categories: ["ticket"] },
  VALIDATE_CONTEXT: {
    toolId: "system.context_summary",
    categories: ["system"]
  },
  TRANSFER_TICKET: { toolId: "ticket.transfer", categories: ["ticket"] },
  UPDATE_ENTITY: {
    toolId: "contact.update_allowed_fields",
    categories: ["contact"]
  },
  SEND_MESSAGE: { toolId: "internal.note.create", categories: ["ticket"] },
  SEND_EMAIL: { toolId: "internal.note.create", categories: ["ticket"] },
  CREATE_CALENDAR_EVENT: { toolId: "system.echo", categories: ["system"] },
  CUSTOM_OPERATION: { toolId: "system.echo", categories: ["system"] }
};

const ACTION_CAPABILITY: Record<ActionType, RuntimeCapabilityKind> = {
  SEARCH: "SEARCH_KNOWLEDGE",
  VALIDATE: "VALIDATE_CONTEXT",
  TRANSFER: "TRANSFER_TICKET",
  UPDATE: "UPDATE_ENTITY",
  SEND_MESSAGE: "SEND_MESSAGE",
  WAIT_CONFIRMATION: "WAIT_CONFIRMATION",
  WAIT_INPUT: "WAIT_INPUT",
  CUSTOM: "CUSTOM_OPERATION"
};

export function resolveCapabilityKind(
  request: RuntimeExecutionRequest
): string {
  const hinted = request.metadata?.capability as string | undefined;
  if (hinted) return hinted;

  const actionType = request.metadata?.actionType as ActionType | undefined;
  if (actionType === "SEARCH") {
    const domain = String(request.parameters?.domain || "").toLowerCase();
    if (domain === "contact" || domain === "customer") return "SEARCH_CONTACT";
    if (domain === "ticket") return "SEARCH_TICKET";
    return "SEARCH_KNOWLEDGE";
  }
  if (actionType && ACTION_CAPABILITY[actionType]) {
    return ACTION_CAPABILITY[actionType];
  }
  return "CUSTOM_OPERATION";
}

function preferenceFor(
  companyId: number,
  capability: string
): McpAdapterPreference {
  const cfg = getMcpConfig(companyId);
  return (
    cfg.capabilityPreferences?.[capability] ||
    (cfg.capabilityPreferences?.default as McpAdapterPreference) ||
    "TOOL_RUNTIME_FIRST"
  );
}

/**
 * RuntimeDispatcher V2.7 — escolhe TOOL_RUNTIME vs MCP (determinístico).
 */
export function dispatchRuntimeCapability(
  request: RuntimeExecutionRequest,
  runtimeType?: RuntimeType,
  companyId?: number
): RuntimeCapability {
  const decision = decideRuntimeDispatch({
    request,
    companyId: companyId || Number(request.metadata?.companyId || 0),
    forcedRuntimeType: runtimeType
  });

  return {
    kind: decision.capability as RuntimeCapabilityKind,
    runtimeType: decision.selectedRuntimeType,
    requiredAdapter: decision.selectedAdapter,
    toolId: decision.selectedTool || undefined,
    providerFunctionName: decision.selectedTool
      ? toolIdToProviderFunctionName(decision.selectedTool.replace(/\./g, "_"))
      : undefined,
    plannerCategories: CAPABILITY_TOOL[decision.capability]?.categories || [
      "system"
    ],
    metadata: {
      operation: request.operation,
      actionId: request.actionId,
      serverId: decision.selectedServerId,
      toolName: decision.selectedTool,
      dispatchDecision: decision,
      noRuntimeExecution:
        decision.capability === "WAIT_CONFIRMATION" ||
        decision.capability === "WAIT_INPUT"
    }
  };
}

export function decideRuntimeDispatch(input: {
  request: RuntimeExecutionRequest;
  companyId: number;
  forcedRuntimeType?: RuntimeType;
}): RuntimeDispatchDecision {
  const capability = resolveCapabilityKind(input.request);
  const pref = preferenceFor(input.companyId, capability);
  const mapping = CAPABILITY_TOOL[capability];
  const toolRuntimeToolId =
    (input.request.metadata?.toolId as string) ||
    mapping?.toolId ||
    "system.echo";

  const servers = listMcpServers(input.companyId).filter(
    s =>
      s.enabled &&
      (s.healthStatus === "HEALTHY" ||
        s.healthStatus === "DEGRADED" ||
        s.healthStatus === "UNKNOWN")
  );
  let mcpTool = null as ReturnType<typeof findMcpToolForCapability>;
  let mcpServerId: string | null = null;
  for (const server of servers) {
    const tools = listMcpTools(input.companyId, server.id);
    const found = findMcpToolForCapability({ tools, capability });
    if (found) {
      mcpTool = found;
      mcpServerId = server.id;
      break;
    }
    // also try raw operation name
    const byName = tools.find(
      t => t.enabled && t.name === input.request.operation
    );
    if (byName) {
      mcpTool = byName;
      mcpServerId = server.id;
      break;
    }
  }

  const mcpAvailable = Boolean(mcpTool && mcpServerId);
  const forced =
    input.forcedRuntimeType ||
    (input.request.metadata?.preferredRuntimeType as RuntimeType | undefined);

  const reasonCodes: string[] = [];
  let useMcp = false;

  if (forced === "MCP" && mcpAvailable) {
    useMcp = true;
    reasonCodes.push("mcp_selected", `preference:${pref}`);
  } else if (forced === "TOOL_RUNTIME") {
    useMcp = false;
    reasonCodes.push("tool_runtime_selected", `preference:${pref}`);
  } else if (pref === "MCP_ONLY") {
    useMcp = mcpAvailable;
    reasonCodes.push(
      useMcp ? "mcp_selected" : "mcp_unavailable_fallback_blocked",
      `preference:${pref}`
    );
  } else if (pref === "TOOL_RUNTIME_ONLY") {
    useMcp = false;
    reasonCodes.push("tool_runtime_selected", `preference:${pref}`);
  } else if (pref === "MCP_FIRST") {
    useMcp = mcpAvailable;
    reasonCodes.push(
      useMcp ? "mcp_selected" : "tool_runtime_selected",
      `preference:${pref}`
    );
  } else if (pref === "AUTOMATIC") {
    useMcp =
      mcpAvailable &&
      Boolean(mcpTool) &&
      mapMcpToolToCapability(mcpTool!) === capability;
    reasonCodes.push(
      useMcp ? "mcp_selected" : "tool_runtime_selected",
      `preference:${pref}`
    );
  } else {
    // TOOL_RUNTIME_FIRST
    useMcp = !mapping && mcpAvailable;
    reasonCodes.push(
      useMcp ? "no_internal_tool_mapping" : "tool_runtime_selected",
      `preference:${pref}`
    );
  }

  const selectedRuntimeType: RuntimeType = useMcp ? "MCP" : "TOOL_RUNTIME";
  const selectedAdapter = useMcp ? "McpRuntimeAdapter" : "ToolRuntimeAdapter";
  const selectedTool = useMcp ? mcpTool!.name : toolRuntimeToolId;
  const selectedServerId = useMcp ? mcpServerId : null;

  const fallback = evaluateFallbackSafety({
    allowFallback: getMcpConfig(input.companyId).allowFallback,
    toolRuntimeAvailable: true,
    classification: mcpTool?.classification || "READ",
    mcpStartedExecution: false,
    mcpResultAmbiguous: false,
    forceMcpOnly: pref === "MCP_ONLY"
  });

  const decision: RuntimeDispatchDecision = {
    requestId: input.request.requestId,
    capability,
    selectedRuntimeType,
    selectedAdapter,
    selectedServerId,
    selectedTool,
    reasonCodes,
    fallbackRuntimeType: useMcp
      ? "TOOL_RUNTIME"
      : mcpAvailable
        ? "MCP"
        : null,
    fallbackAvailable: fallback === "SAFE",
    confidence: useMcp ? 0.85 : 0.9,
    createdAt: new Date().toISOString(),
    metadata: {
      preference: pref,
      mcpAvailable,
      fallbackSafety: fallback
    }
  };

  return decision;
}

export default { dispatchRuntimeCapability, decideRuntimeDispatch };
