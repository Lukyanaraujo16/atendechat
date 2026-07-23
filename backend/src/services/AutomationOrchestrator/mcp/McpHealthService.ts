import { getMcpServer, setMcpServerHealth } from "./McpServerStore";
import { defaultMcpClientManager } from "./McpClientManager";
import { McpHealthState } from "../../../config/automationMcpConstants";
import { validateMcpEndpoint } from "./McpEndpointSecurityValidator";

/**
 * McpHealthService — health sem operações destrutivas.
 */
export async function checkMcpServerHealth(input: {
  companyId: number;
  serverId: string;
  isSuperAdmin?: boolean;
}): Promise<{
  status: McpHealthState;
  latencyMs: number;
  toolsCount: number;
  errorCode: string | null;
}> {
  const server = getMcpServer(input.companyId, input.serverId);
  if (!server) {
    return {
      status: "UNKNOWN",
      latencyMs: 0,
      toolsCount: 0,
      errorCode: "ERR_MCP_SERVER_NOT_FOUND"
    };
  }

  const security = validateMcpEndpoint({
    companyId: input.companyId,
    transportType: server.transportType,
    endpoint: server.endpoint,
    command: server.command,
    isSuperAdmin: input.isSuperAdmin
  });
  if (!security.allowed) {
    setMcpServerHealth(
      input.companyId,
      input.serverId,
      "UNHEALTHY",
      security.reasonCodes[0]
    );
    return {
      status: "UNHEALTHY",
      latencyMs: 0,
      toolsCount: 0,
      errorCode: security.reasonCodes[0]
    };
  }

  const started = Date.now();
  try {
    const client = await defaultMcpClientManager.connect({
      companyId: input.companyId,
      serverId: input.serverId,
      isSuperAdmin: input.isSuperAdmin
    });
    const listed = await client.listTools();
    defaultMcpClientManager.releaseExecution(input.companyId, input.serverId);
    const latencyMs = Date.now() - started;
    const status: McpHealthState =
      latencyMs > 5_000 ? "DEGRADED" : "HEALTHY";
    setMcpServerHealth(input.companyId, input.serverId, status, null);
    return {
      status,
      latencyMs,
      toolsCount: listed.tools?.length || 0,
      errorCode: null
    };
  } catch (err) {
    const code =
      err instanceof Error && err.message.startsWith("ERR_MCP_")
        ? err.message
        : "ERR_MCP_CONNECTION_FAILED";
    setMcpServerHealth(input.companyId, input.serverId, "UNHEALTHY", code);
    return {
      status: "UNHEALTHY",
      latencyMs: Date.now() - started,
      toolsCount: 0,
      errorCode: code
    };
  }
}

export default { checkMcpServerHealth };
