import { getMcpConfig } from "./McpConfig";
import { getMcpServer } from "./McpServerStore";
import { getMcpTool } from "./McpToolCatalog";
import { validateMcpInput } from "./McpInputValidator";
import { emitMcpEvent } from "./McpEvents";
import { McpPolicyDecision, McpToolDescriptor } from "./types";
import { McpExecutionMode } from "../../../config/automationMcpConstants";

/**
 * McpToolPolicyEngine — validações pré-execução.
 */
export function evaluateMcpToolPolicy(input: {
  companyId: number;
  serverId: string;
  toolName: string;
  args?: Record<string, unknown>;
  confirmed?: boolean;
  mode?: "preview" | "dry_run" | "execute" | "confirm";
  planEnabled?: boolean;
  permissionGranted?: boolean;
}): McpPolicyDecision {
  const cfg = getMcpConfig(input.companyId);
  const violations: string[] = [];
  const warnings: string[] = [];
  const reasonCodes: string[] = [];

  if (!cfg.enabled || input.planEnabled === false) {
    violations.push("ERR_MCP_POLICY_DENIED");
    reasonCodes.push("plan_or_config_disabled");
  }
  if (input.permissionGranted === false) {
    violations.push("ERR_MCP_TENANT_FORBIDDEN");
    reasonCodes.push("permission_denied");
  }

  const server = getMcpServer(input.companyId, input.serverId);
  if (!server) {
    violations.push("ERR_MCP_SERVER_NOT_FOUND");
  } else {
    if (!server.enabled) violations.push("ERR_MCP_SERVER_DISABLED");
    if (server.healthStatus === "UNHEALTHY") {
      violations.push("ERR_MCP_UNHEALTHY");
    } else if (server.healthStatus === "DEGRADED") {
      warnings.push("server_degraded");
    }
    if (server.blockedTools.includes(input.toolName)) {
      violations.push("ERR_MCP_TOOL_BLOCKED");
    }
    if (
      server.allowedTools &&
      !server.allowedTools.includes(input.toolName)
    ) {
      violations.push("ERR_MCP_TOOL_BLOCKED");
      reasonCodes.push("not_in_allowlist");
    }
  }

  const tool = getMcpTool(input.companyId, input.serverId, input.toolName);
  if (!tool) {
    violations.push("ERR_MCP_TOOL_NOT_FOUND");
  } else if (!tool.enabled) {
    violations.push("ERR_MCP_TOOL_DISABLED");
  }

  const classification = tool?.classification || "UNKNOWN";
  const effectiveClassification =
    classification === "UNKNOWN" ? "WRITE" : classification;

  if (server?.readOnly && effectiveClassification === "WRITE") {
    violations.push("ERR_MCP_POLICY_DENIED");
    reasonCodes.push("server_read_only");
  }

  const validation = validateMcpInput({
    schema: tool?.inputSchema || null,
    args: input.args || {},
    schemaHash: tool?.schemaHash
  });
  if (!validation.valid) {
    violations.push("ERR_MCP_INPUT_INVALID");
    reasonCodes.push(...validation.errors);
  }
  warnings.push(...validation.warnings);

  const requireConfirmation =
    effectiveClassification === "WRITE" &&
    ((server?.requireConfirmationForWrites ??
      cfg.requireConfirmationForWrites) ||
      tool?.requiresConfirmation === true);

  let executionMode: McpExecutionMode = "EXECUTE";
  if (violations.length) {
    executionMode = "BLOCKED";
  } else if (input.mode === "preview") {
    executionMode = "PREVIEW";
  } else if (input.mode === "dry_run") {
    executionMode = "DRY_RUN";
  } else if (requireConfirmation && !input.confirmed) {
    executionMode = "CONFIRMATION_REQUIRED";
    reasonCodes.push("ERR_MCP_TOOL_CONFIRMATION_REQUIRED");
  }

  const approved =
    violations.length === 0 &&
    executionMode !== "BLOCKED" &&
    executionMode !== "CONFIRMATION_REQUIRED";

  const decision: McpPolicyDecision = {
    approved:
      approved ||
      executionMode === "PREVIEW" ||
      executionMode === "DRY_RUN",
    executionMode,
    requiresConfirmation:
      executionMode === "CONFIRMATION_REQUIRED" || requireConfirmation,
    violations,
    warnings,
    reasonCodes,
    effectiveTimeout:
      server?.executionTimeoutMs || cfg.executionTimeoutMs,
    effectiveRateLimit: null,
    sanitizedArguments: validation.sanitizedArguments,
    classification: effectiveClassification as any,
    metadata: {
      toolEnabled: tool?.enabled === true,
      schemaStatus: validation.status
    }
  };

  emitMcpEvent(input.companyId, "MCP_POLICY_EVALUATED", input.toolName, {
    executionMode: decision.executionMode,
    approved: decision.approved
  });

  return decision;
}

export default { evaluateMcpToolPolicy };
