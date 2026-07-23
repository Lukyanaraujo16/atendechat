import { createHash } from "crypto";
import { defaultMcpClientManager } from "./McpClientManager";
import { getMcpConfig } from "./McpConfig";
import {
  classifyMcpTool,
  defaultEnabledForClassification,
  hashSchema,
  listMcpTools,
  upsertMcpTool
} from "./McpToolCatalog";
import { emitMcpEvent } from "./McpEvents";
import { McpToolDescriptor } from "./types";

/**
 * McpCapabilityDiscoveryService — descobre TOOLS (resources/prompts só inspeção).
 */
export async function discoverMcpTools(input: {
  companyId: number;
  serverId: string;
  isSuperAdmin?: boolean;
}): Promise<{ tools: McpToolDescriptor[]; added: string[]; removed: string[]; changed: string[] }> {
  const cfg = getMcpConfig(input.companyId);
  const client = await defaultMcpClientManager.connect({
    companyId: input.companyId,
    serverId: input.serverId,
    isSuperAdmin: input.isSuperAdmin
  });

  try {
    const listed = await client.listTools();
    const previous = listMcpTools(input.companyId, input.serverId);
    const prevNames = new Set(previous.map(t => t.name));
    const nextNames = new Set<string>();
    const added: string[] = [];
    const changed: string[] = [];
    const tools: McpToolDescriptor[] = [];

    for (const raw of listed.tools || []) {
      if (tools.length >= cfg.maxToolsPerServer) break;
      nextNames.add(raw.name);
      const annotations = (raw.annotations || {}) as Record<string, unknown>;
      const classification = classifyMcpTool({
        name: raw.name,
        description: raw.description,
        annotations
      });
      const schemaHash = hashSchema(raw.inputSchema);
      const prev = previous.find(t => t.name === raw.name);
      const descriptor: McpToolDescriptor = {
        serverId: input.serverId,
        companyId: input.companyId,
        name: raw.name,
        title: raw.title || raw.name,
        description: raw.description || "",
        inputSchema: (raw.inputSchema as Record<string, unknown>) || null,
        annotations,
        readOnlyHint:
          typeof annotations.readOnlyHint === "boolean"
            ? (annotations.readOnlyHint as boolean)
            : null,
        destructiveHint:
          typeof annotations.destructiveHint === "boolean"
            ? (annotations.destructiveHint as boolean)
            : null,
        idempotentHint:
          typeof annotations.idempotentHint === "boolean"
            ? (annotations.idempotentHint as boolean)
            : null,
        openWorldHint:
          typeof annotations.openWorldHint === "boolean"
            ? (annotations.openWorldHint as boolean)
            : null,
        requiresConfirmation:
          classification !== "READ" ||
          annotations.destructiveHint === true,
        enabled: prev
          ? prev.enabled
          : defaultEnabledForClassification(input.companyId, classification),
        classification,
        capabilityOverride: prev?.capabilityOverride || null,
        discoveredAt: new Date().toISOString(),
        schemaHash,
        metadata: {}
      };
      if (!prevNames.has(raw.name)) added.push(raw.name);
      if (prev && prev.schemaHash !== schemaHash) changed.push(raw.name);
      tools.push(upsertMcpTool(input.companyId, descriptor));
      emitMcpEvent(input.companyId, "MCP_TOOL_DISCOVERED", raw.name, {
        serverId: input.serverId,
        classification
      });
      if (prev && prev.schemaHash !== schemaHash) {
        emitMcpEvent(input.companyId, "MCP_TOOL_CHANGED", raw.name, {
          serverId: input.serverId,
          schemaHash
        });
      }
    }

    const removed = previous
      .map(t => t.name)
      .filter(n => !nextNames.has(n));

    return { tools, added, removed, changed };
  } finally {
    defaultMcpClientManager.releaseExecution(input.companyId, input.serverId);
  }
}

export async function syncMcpCatalog(input: {
  companyId: number;
  serverId: string;
  isSuperAdmin?: boolean;
}) {
  const result = await discoverMcpTools(input);
  emitMcpEvent(input.companyId, "MCP_CATALOG_SYNCED", input.serverId, {
    added: result.added.length,
    removed: result.removed.length,
    changed: result.changed.length,
    total: result.tools.length
  });
  return {
    ...result,
    syncId: `sync_${createHash("sha256")
      .update(`${input.serverId}:${Date.now()}`)
      .digest("hex")
      .slice(0, 10)}`,
    syncedAt: new Date().toISOString()
  };
}

export default { discoverMcpTools, syncMcpCatalog };
