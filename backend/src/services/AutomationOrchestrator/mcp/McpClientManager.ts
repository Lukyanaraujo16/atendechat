import { getMcpConfig } from "./McpConfig";
import { getMcpServer, setMcpServerHealth } from "./McpServerStore";
import { resolveMcpCredentialHeaders } from "./McpCredentialStore";
import { validateMcpEndpoint } from "./McpEndpointSecurityValidator";
import {
  defaultMcpConnectionPool,
  FakeOrRealClient,
  McpConnectionPool
} from "./McpConnectionPool";
import { emitMcpEvent } from "./McpEvents";
import { connectOfficialMcpClient } from "./McpSdkLoader";

export type McpClientFactory = (input: {
  companyId: number;
  serverId: string;
  endpoint: string;
  headers: Record<string, string>;
  transportType: string;
}) => Promise<FakeOrRealClient>;

let injectedFactory: McpClientFactory | null = null;

/**
 * Injeta factory (tests / fake server). Produção usa SDK oficial.
 */
export function setMcpClientFactory(factory: McpClientFactory | null): void {
  injectedFactory = factory;
}

async function defaultSdkFactory(input: {
  companyId: number;
  serverId: string;
  endpoint: string;
  headers: Record<string, string>;
  transportType: string;
}): Promise<FakeOrRealClient> {
  return connectOfficialMcpClient(input) as Promise<FakeOrRealClient>;
}

/**
 * McpClientManager — ciclo de vida do cliente MCP por companyId+serverId.
 */
export class McpClientManager {
  constructor(private readonly pool: McpConnectionPool = defaultMcpConnectionPool) {}

  async connect(input: {
    companyId: number;
    serverId: string;
    isSuperAdmin?: boolean;
  }): Promise<FakeOrRealClient> {
    const server = getMcpServer(input.companyId, input.serverId);
    if (!server) throw new Error("ERR_MCP_SERVER_NOT_FOUND");
    if (!server.enabled) throw new Error("ERR_MCP_SERVER_DISABLED");

    const security = validateMcpEndpoint({
      companyId: input.companyId,
      transportType: server.transportType,
      endpoint: server.endpoint,
      command: server.command,
      isSuperAdmin: input.isSuperAdmin
    });
    if (!security.allowed) {
      throw new Error(security.reasonCodes[0] || "ERR_MCP_TRANSPORT_NOT_ALLOWED");
    }

    emitMcpEvent(input.companyId, "MCP_CONNECTION_STARTED", server.id);

    const headers = {
      ...server.headers,
      ...resolveMcpCredentialHeaders(input.companyId, server.credentialId)
    };

    const factory = injectedFactory || defaultSdkFactory;
    const cfg = getMcpConfig(input.companyId);
    const timeoutMs = server.connectionTimeoutMs || cfg.connectionTimeoutMs;

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const entry = await Promise.race([
        this.pool.acquire({
          companyId: input.companyId,
          serverId: input.serverId,
          connect: () =>
            factory({
              companyId: input.companyId,
              serverId: input.serverId,
              endpoint: server.endpoint || "",
              headers,
              transportType: server.transportType
            })
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("ERR_MCP_CONNECTION_TIMEOUT")),
            timeoutMs
          );
        })
      ]);

      setMcpServerHealth(input.companyId, input.serverId, "HEALTHY", null);
      emitMcpEvent(input.companyId, "MCP_CONNECTION_ESTABLISHED", server.id);
      return entry.client!;
    } catch (err) {
      const code =
        err instanceof Error && err.message.startsWith("ERR_MCP_")
          ? err.message
          : "ERR_MCP_CONNECTION_FAILED";
      setMcpServerHealth(input.companyId, input.serverId, "UNHEALTHY", code);
      emitMcpEvent(input.companyId, "MCP_CONNECTION_FAILED", server.id, code);
      throw err instanceof Error ? err : new Error(code);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async disconnect(companyId: number, serverId: string): Promise<void> {
    await this.pool.release(companyId, serverId);
  }

  releaseExecution(companyId: number, serverId: string): void {
    this.pool.releaseExecution(companyId, serverId);
  }
}

export const defaultMcpClientManager = new McpClientManager();

export default defaultMcpClientManager;
