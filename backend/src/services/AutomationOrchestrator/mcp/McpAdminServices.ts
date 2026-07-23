import { createHash } from "crypto";
import {
  AUTOMATION_MCP_FEATURE_KEY,
  AUTOMATION_MCP_SDK_PACKAGE,
  AUTOMATION_MCP_SDK_VERSION
} from "../../../config/automationMcpConstants";
import { assertAgentOsPlanFeature } from "../security/AgentOsPlanGate";
import { revalidateMcpBoundary } from "../security/AgentOsBoundaryGuard";
import { getMcpConfig, setMcpConfig } from "./McpConfig";
import {
  createMcpServer,
  deleteMcpServer,
  getMcpServer,
  listMcpServers,
  updateMcpServer
} from "./McpServerStore";
import {
  createMcpCredential,
  listMcpCredentials
} from "./McpCredentialStore";
import { validateMcpEndpoint } from "./McpEndpointSecurityValidator";
import { defaultMcpClientManager } from "./McpClientManager";
import { checkMcpServerHealth } from "./McpHealthService";
import { syncMcpCatalog } from "./McpCapabilityDiscovery";
import {
  getMcpTool,
  listMcpTools,
  updateMcpToolOverrides
} from "./McpToolCatalog";
import { evaluateMcpToolPolicy } from "./McpToolPolicyEngine";
import { mapMcpToolToCapability } from "./McpCapabilityMapper";
import { normalizeMcpResult } from "./McpResultNormalizer";
import { evaluateFallbackSafety } from "./McpSafetyEvaluators";
import { emitMcpEvent, listMcpEvents } from "./McpEvents";
import {
  findMcpExecution,
  getMcpMetricsBase,
  listMcpExecutions,
  recordMcpMetric
} from "./McpMetrics";
import { decideRuntimeDispatch } from "../runtimeIntegration/RuntimeDispatcher";
import { RuntimeIntegrationEngine } from "../runtimeIntegration/RuntimeIntegrationEngine";
import { mapStepToExecutionAction } from "../cognitive/action/ActionExecutionEngine";
import { buildKnowledgeFromFeedback } from "../cognitive/memory/KnowledgeBuilder";
import { CognitiveMemoryEngine } from "../cognitive/memory/CognitiveMemoryEngine";
import { ProcessExecutionFeedbackService } from "../cognitive/feedback/ExecutionFeedbackAdminServices";

function assertTenant(companyId: number, resourceCompanyId: number): void {
  if (companyId !== resourceCompanyId) {
    throw new Error("ERR_MCP_TENANT_FORBIDDEN");
  }
}

export async function CreateMcpServerService(input: {
  companyId: number;
  userId?: number | null;
  isSuperAdmin?: boolean;
  body: Record<string, unknown>;
}) {
  const security = validateMcpEndpoint({
    companyId: input.companyId,
    transportType: (input.body.transportType as any) || "STREAMABLE_HTTP",
    endpoint: (input.body.endpoint as string) || null,
    command: (input.body.command as string) || null,
    isSuperAdmin: input.isSuperAdmin
  });
  if (!security.allowed) {
    throw new Error(security.reasonCodes[0] || "ERR_MCP_TRANSPORT_NOT_ALLOWED");
  }
  const server = createMcpServer({
    companyId: input.companyId,
    name: String(input.body.name || "MCP Server"),
    description: String(input.body.description || ""),
    transportType: (input.body.transportType as any) || "STREAMABLE_HTTP",
    endpoint: (input.body.endpoint as string) || null,
    command: (input.body.command as string) || null,
    args: (input.body.args as string[]) || [],
    environment: {},
    headers: (input.body.headers as Record<string, string>) || {},
    credentialId: (input.body.credentialId as string) || null,
    allowedCapabilities: (input.body.allowedCapabilities as string[]) || [],
    allowedTools: (input.body.allowedTools as string[] | null) ?? null,
    blockedTools: (input.body.blockedTools as string[]) || [],
    requireConfirmationForWrites: input.body.requireConfirmationForWrites as boolean,
    readOnly: input.body.readOnly === true,
    createdBy: input.userId ?? null
  });
  emitMcpEvent(input.companyId, "MCP_SERVER_CREATED", server.id);
  return { server };
}

export async function ListMcpServersService(input: { companyId: number }) {
  return { servers: listMcpServers(input.companyId) };
}

export async function GetMcpServerService(input: {
  companyId: number;
  id: string;
}) {
  const server = getMcpServer(input.companyId, input.id);
  if (!server) throw new Error("ERR_MCP_SERVER_NOT_FOUND");
  return { server };
}

export async function UpdateMcpServerService(input: {
  companyId: number;
  id: string;
  body: Record<string, unknown>;
  isSuperAdmin?: boolean;
}) {
  const current = getMcpServer(input.companyId, input.id);
  if (!current) throw new Error("ERR_MCP_SERVER_NOT_FOUND");
  assertTenant(input.companyId, current.companyId);
  if (input.body.endpoint || input.body.transportType) {
    const security = validateMcpEndpoint({
      companyId: input.companyId,
      transportType: (input.body.transportType as any) || current.transportType,
      endpoint: (input.body.endpoint as string) ?? current.endpoint,
      command: (input.body.command as string) ?? current.command,
      isSuperAdmin: input.isSuperAdmin
    });
    if (!security.allowed) {
      throw new Error(security.reasonCodes[0] || "ERR_MCP_TRANSPORT_NOT_ALLOWED");
    }
  }
  const server = updateMcpServer(input.companyId, input.id, input.body as any);
  if (input.body.enabled === true) {
    emitMcpEvent(input.companyId, "MCP_SERVER_ENABLED", input.id);
  }
  if (input.body.enabled === false) {
    emitMcpEvent(input.companyId, "MCP_SERVER_DISABLED", input.id);
  }
  emitMcpEvent(input.companyId, "MCP_SERVER_UPDATED", input.id);
  return { server };
}

export async function DeleteMcpServerService(input: {
  companyId: number;
  id: string;
}) {
  const current = getMcpServer(input.companyId, input.id);
  if (!current) throw new Error("ERR_MCP_SERVER_NOT_FOUND");
  await defaultMcpClientManager.disconnect(input.companyId, input.id);
  deleteMcpServer(input.companyId, input.id);
  return { deleted: true };
}

export async function CreateMcpCredentialService(input: {
  companyId: number;
  userId?: number | null;
  body: Record<string, unknown>;
}) {
  const payload = (input.body.payload || input.body.secret || {}) as Record<
    string,
    string
  >;
  const cred = createMcpCredential({
    companyId: input.companyId,
    name: String(input.body.name || "credential"),
    authType: (input.body.authType as any) || "BEARER_TOKEN",
    payload,
    createdBy: input.userId ?? null
  });
  const { encryptedPayload: _, ...safe } = cred;
  return { credential: { ...safe, encryptedPayload: undefined } };
}

export async function ListMcpCredentialsService(input: { companyId: number }) {
  return { credentials: listMcpCredentials(input.companyId) };
}

export async function TestMcpConnectionService(input: {
  companyId: number;
  id: string;
  isSuperAdmin?: boolean;
}) {
  return checkMcpServerHealth({
    companyId: input.companyId,
    serverId: input.id,
    isSuperAdmin: input.isSuperAdmin
  });
}

export async function ConnectMcpServerService(input: {
  companyId: number;
  id: string;
  isSuperAdmin?: boolean;
}) {
  await defaultMcpClientManager.connect({
    companyId: input.companyId,
    serverId: input.id,
    isSuperAdmin: input.isSuperAdmin
  });
  defaultMcpClientManager.releaseExecution(input.companyId, input.id);
  return { connected: true };
}

export async function DisconnectMcpServerService(input: {
  companyId: number;
  id: string;
}) {
  await defaultMcpClientManager.disconnect(input.companyId, input.id);
  return { disconnected: true };
}

export async function SyncMcpCatalogService(input: {
  companyId: number;
  id: string;
  isSuperAdmin?: boolean;
}) {
  const result = await syncMcpCatalog({
    companyId: input.companyId,
    serverId: input.id,
    isSuperAdmin: input.isSuperAdmin
  });
  recordMcpMetric("catalogSync");
  return result;
}

export async function ListMcpToolsService(input: {
  companyId: number;
  serverId?: string;
}) {
  const tools = listMcpTools(input.companyId, input.serverId).map(t => ({
    ...t,
    mappedCapability: mapMcpToolToCapability(t)
  }));
  return { tools };
}

export async function GetMcpToolService(input: {
  companyId: number;
  serverId: string;
  toolName: string;
}) {
  const tool = getMcpTool(input.companyId, input.serverId, input.toolName);
  if (!tool) throw new Error("ERR_MCP_TOOL_NOT_FOUND");
  return {
    tool: { ...tool, mappedCapability: mapMcpToolToCapability(tool) }
  };
}

export async function UpdateMcpToolService(input: {
  companyId: number;
  serverId: string;
  toolName: string;
  body: Record<string, unknown>;
}) {
  const tool = updateMcpToolOverrides(
    input.companyId,
    input.serverId,
    input.toolName,
    input.body as any
  );
  if (!tool) throw new Error("ERR_MCP_TOOL_NOT_FOUND");
  return { tool };
}

export async function PreviewMcpToolService(input: {
  companyId: number;
  serverId: string;
  toolName: string;
  args?: Record<string, unknown>;
}) {
  await assertAgentOsPlanFeature(input.companyId, AUTOMATION_MCP_FEATURE_KEY);
  const policy = evaluateMcpToolPolicy({
    companyId: input.companyId,
    serverId: input.serverId,
    toolName: input.toolName,
    args: input.args,
    mode: "preview",
    planEnabled: true
  });
  revalidateMcpBoundary({
    allowed: policy.approved === true,
    reason: (policy.reasonCodes && policy.reasonCodes[0]) || "mcp_policy"
  });
  return { policy, mode: "PREVIEW" };
}

export async function ExecuteMcpToolService(input: {
  companyId: number;
  userId?: number | null;
  serverId: string;
  toolName: string;
  args?: Record<string, unknown>;
  confirmed?: boolean;
  mode?: "execute" | "confirm" | "dry_run";
}) {
  await assertAgentOsPlanFeature(input.companyId, AUTOMATION_MCP_FEATURE_KEY);
  const tool = getMcpTool(input.companyId, input.serverId, input.toolName);
  const capability = tool
    ? mapMcpToolToCapability(tool)
    : "CUSTOM_OPERATION";
  const action = mapStepToExecutionAction({
    stepId: `mcp_${Date.now()}`,
    stepType: "custom",
    objective: `mcp:${input.toolName}`,
    metadata: {
      preferredRuntimeType: "MCP",
      mcpServerId: input.serverId,
      toolId: input.toolName,
      mcpMode: input.mode || "execute",
      confirmed: input.confirmed === true,
      parameters: input.args || {},
      capability
    }
  });
  action.entities = Object.entries(input.args || {}).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  const engine = new RuntimeIntegrationEngine({
    companyId: input.companyId,
    userId: input.userId
  });
  const record = await engine.execute({ action });
  return { record };
}

export async function GetMcpDashboardService(input: { companyId: number }) {
  const servers = listMcpServers(input.companyId);
  const tools = listMcpTools(input.companyId);
  const base = getMcpMetricsBase();
  return {
    servers: servers.length,
    healthy: servers.filter(s => s.healthStatus === "HEALTHY").length,
    degraded: servers.filter(s => s.healthStatus === "DEGRADED").length,
    unhealthy: servers.filter(s => s.healthStatus === "UNHEALTHY").length,
    tools: tools.length,
    readTools: tools.filter(t => t.classification === "READ").length,
    writeTools: tools.filter(t => t.classification === "WRITE").length,
    unknownTools: tools.filter(t => t.classification === "UNKNOWN").length,
    requests: base.requests,
    successRate: base.requests ? base.successes / base.requests : 0,
    failures: base.failures,
    averageLatency: base.requests ? base.latencySum / base.requests : 0,
    policyDenials: base.policyDenials,
    metrics: {
      ...base,
      serversConfigured: servers.length,
      serversEnabled: servers.filter(s => s.enabled).length,
      healthyServers: servers.filter(s => s.healthStatus === "HEALTHY").length,
      degradedServers: servers.filter(s => s.healthStatus === "DEGRADED").length,
      unhealthyServers: servers.filter(s => s.healthStatus === "UNHEALTHY")
        .length,
      toolsDiscovered: tools.length,
      toolsEnabled: tools.filter(t => t.enabled).length,
      readTools: tools.filter(t => t.classification === "READ").length,
      writeTools: tools.filter(t => t.classification === "WRITE").length,
      unknownTools: tools.filter(t => t.classification === "UNKNOWN").length,
      averageLatency: base.requests ? base.latencySum / base.requests : 0
    },
    sdk: {
      package: AUTOMATION_MCP_SDK_PACKAGE,
      version: AUTOMATION_MCP_SDK_VERSION
    },
    liveIntegrationEnabled: false
  };
}

export async function GetMcpMetricsService(input: { companyId: number }) {
  const dash = await GetMcpDashboardService(input);
  return {
    metrics: dash.metrics,
    events: listMcpEvents(input.companyId, 30),
    liveIntegrationEnabled: false
  };
}

export async function GetMcpConfigService(input: { companyId: number }) {
  return { config: getMcpConfig(input.companyId) };
}

export async function UpsertMcpConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  return { config: setMcpConfig(input.companyId, input.config) };
}

export async function ListMcpExecutionsService(input: {
  companyId: number;
  limit?: number;
}) {
  return { executions: listMcpExecutions(input.companyId, input.limit || 50) };
}

export async function GetMcpExecutionService(input: {
  companyId: number;
  id: string;
}) {
  return { execution: findMcpExecution(input.companyId, input.id) };
}

export async function SimulateMcpPolicyService(input: {
  companyId: number;
  serverId: string;
  toolName: string;
  args?: Record<string, unknown>;
  confirmed?: boolean;
  mode?: "preview" | "dry_run" | "execute";
}) {
  return {
    policy: evaluateMcpToolPolicy({
      companyId: input.companyId,
      serverId: input.serverId,
      toolName: input.toolName,
      args: input.args,
      confirmed: input.confirmed,
      mode: input.mode || "execute"
    })
  };
}

export async function SimulateMcpFallbackService(input: {
  allowFallback?: boolean;
  classification?: "READ" | "WRITE" | "UNKNOWN";
  mcpStartedExecution?: boolean;
  mcpResultAmbiguous?: boolean;
}) {
  return {
    safety: evaluateFallbackSafety({
      allowFallback: input.allowFallback !== false,
      toolRuntimeAvailable: true,
      classification: input.classification || "READ",
      mcpStartedExecution: input.mcpStartedExecution === true,
      mcpResultAmbiguous: input.mcpResultAmbiguous === true
    })
  };
}

export async function NormalizeMcpResultService(input: {
  raw: Record<string, unknown>;
}) {
  return { result: normalizeMcpResult(input.raw as any) };
}

export async function InspectMcpDispatchService(input: {
  companyId: number;
  capability?: string;
  operation?: string;
}) {
  const action = mapStepToExecutionAction({
    stepId: "dispatch",
    stepType: "custom",
    objective: "inspect",
    metadata: {
      capability: input.capability,
      operation: input.operation
    }
  });
  const { adaptExecutionActionToRuntimeRequest } = await import(
    "../runtimeIntegration/ExecutionAdapter"
  );
  const request = adaptExecutionActionToRuntimeRequest({
    action,
    companyId: input.companyId
  });
  request.metadata.companyId = input.companyId;
  if (input.capability) request.metadata.capability = input.capability;
  return {
    decision: decideRuntimeDispatch({
      request,
      companyId: input.companyId
    })
  };
}

export async function ReplayMcpRuntimeService(input: {
  companyId: number;
  userId?: number | null;
  serverId: string;
  toolName: string;
  args?: Record<string, unknown>;
  persistKnowledge?: boolean;
}) {
  const executed = await ExecuteMcpToolService({
    companyId: input.companyId,
    userId: input.userId,
    serverId: input.serverId,
    toolName: input.toolName,
    args: input.args,
    mode: "dry_run"
  });

  const feedback = await ProcessExecutionFeedbackService({
    companyId: input.companyId,
    runtimeResult: executed.record.adapterResult as any,
    actionResult: executed.record.actionResult as any,
    actionId: executed.record.request.actionId
  });

  let knowledgeObjects = null as any;
  if (input.persistKnowledge) {
    knowledgeObjects = buildKnowledgeFromFeedback({
      tenantId: input.companyId,
      feedback: feedback.record.feedback
    });
    const mem = new CognitiveMemoryEngine();
    await mem.saveMany(knowledgeObjects);
  }

  return {
    replay: {
      id: `mcpreplay_${createHash("sha256")
        .update(`${Date.now()}`)
        .digest("hex")
        .slice(0, 12)}`,
      dispatch: executed.record.capability.metadata?.dispatchDecision,
      runtime: executed.record,
      feedback: feedback.record.feedback,
      sessionUpdate: feedback.record.sessionUpdate,
      knowledgeObjects,
      liveIntegrationEnabled: false
    }
  };
}

export default {
  CreateMcpServerService,
  GetMcpDashboardService
};
