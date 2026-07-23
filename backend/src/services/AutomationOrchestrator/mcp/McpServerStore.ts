import { createHash } from "crypto";
import { getMcpConfig } from "./McpConfig";
import { McpHealthState, McpTransportType } from "../../../config/automationMcpConstants";
import { McpServerConfig } from "./types";
import { mcpRepository } from "../persistence/repositories/McpRepository";

const serversByCompany = new Map<number, Map<string, McpServerConfig>>();

function table(companyId: number): Map<string, McpServerConfig> {
  if (!serversByCompany.has(companyId)) {
    serversByCompany.set(companyId, new Map());
  }
  return serversByCompany.get(companyId)!;
}

export function createMcpServer(input: {
  companyId: number;
  name: string;
  description?: string;
  transportType: McpTransportType;
  endpoint?: string | null;
  command?: string | null;
  args?: string[];
  environment?: Record<string, string>;
  headers?: Record<string, string>;
  credentialId?: string | null;
  allowedCapabilities?: string[];
  allowedTools?: string[] | null;
  blockedTools?: string[];
  requireConfirmationForWrites?: boolean;
  readOnly?: boolean;
  createdBy?: number | null;
  metadata?: Record<string, unknown>;
}): McpServerConfig {
  const cfg = getMcpConfig(input.companyId);
  if (table(input.companyId).size >= cfg.maxServersPerCompany) {
    throw new Error("ERR_MCP_POLICY_DENIED:max_servers");
  }
  const now = new Date().toISOString();
  const server: McpServerConfig = {
    id: `mcpsrv_${createHash("sha256")
      .update(`${input.companyId}:${input.name}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId: input.companyId,
    name: input.name,
    description: input.description || "",
    enabled: true,
    transportType: input.transportType,
    endpoint: input.endpoint ?? null,
    command: input.command ?? null,
    args: input.args || [],
    environment: input.environment || {},
    headers: input.headers || {},
    credentialId: input.credentialId ?? null,
    connectionTimeoutMs: cfg.connectionTimeoutMs,
    executionTimeoutMs: cfg.executionTimeoutMs,
    allowedCapabilities: input.allowedCapabilities || [],
    allowedTools: input.allowedTools ?? null,
    blockedTools: input.blockedTools || [],
    requireConfirmationForWrites:
      input.requireConfirmationForWrites ?? cfg.requireConfirmationForWrites,
    readOnly: input.readOnly === true,
    healthStatus: "UNKNOWN",
    lastHealthCheckAt: null,
    lastConnectedAt: null,
    lastErrorCode: null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata || {}
  };
  table(input.companyId).set(server.id, server);
  mcpRepository.upsertServerFireAndForget(input.companyId, {
    ...server,
    slug: server.id,
    transport: server.transportType
  } as any);
  return { ...server };
}

export function getMcpServer(
  companyId: number,
  id: string
): McpServerConfig | null {
  const s = table(companyId).get(id);
  return s ? { ...s } : null;
}

export function listMcpServers(companyId: number): McpServerConfig[] {
  return Array.from(table(companyId).values()).map(s => ({ ...s }));
}

export function updateMcpServer(
  companyId: number,
  id: string,
  patch: Partial<McpServerConfig>
): McpServerConfig | null {
  const current = table(companyId).get(id);
  if (!current) return null;
  const { companyId: _c, id: _i, ...safe } = patch as any;
  const next: McpServerConfig = {
    ...current,
    ...safe,
    companyId: current.companyId,
    id: current.id,
    updatedAt: new Date().toISOString()
  };
  table(companyId).set(id, next);
  mcpRepository.upsertServerFireAndForget(companyId, {
    ...next,
    slug: next.id,
    transport: next.transportType
  } as any);
  return { ...next };
}

export function deleteMcpServer(companyId: number, id: string): boolean {
  return table(companyId).delete(id);
}

export function setMcpServerHealth(
  companyId: number,
  id: string,
  health: McpHealthState,
  errorCode?: string | null
): void {
  const s = table(companyId).get(id);
  if (!s) return;
  s.healthStatus = health;
  s.lastHealthCheckAt = new Date().toISOString();
  if (errorCode !== undefined) s.lastErrorCode = errorCode;
  if (health === "HEALTHY") s.lastConnectedAt = s.lastHealthCheckAt;
  s.updatedAt = s.lastHealthCheckAt;
  table(companyId).set(id, s);
}

export function __resetMcpServersForTests(): void {
  serversByCompany.clear();
}

/** Wave 5 DB-first hydrate. */
export function __hydrateMcpServer(
  companyId: number,
  server: McpServerConfig
): void {
  if (!server?.id) return;
  table(companyId).set(server.id, server);
}

export default {
  createMcpServer,
  getMcpServer,
  listMcpServers,
  updateMcpServer,
  deleteMcpServer
};
