import { createHash } from "crypto";
import { getMcpConfig } from "./McpConfig";
import { McpToolClassification } from "../../../config/automationMcpConstants";
import { McpToolDescriptor } from "./types";

const toolsByCompany = new Map<number, Map<string, McpToolDescriptor>>();

function toolKey(serverId: string, name: string): string {
  return `${serverId}::${name}`;
}

function table(companyId: number): Map<string, McpToolDescriptor> {
  if (!toolsByCompany.has(companyId)) {
    toolsByCompany.set(companyId, new Map());
  }
  return toolsByCompany.get(companyId)!;
}

export function hashSchema(schema: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(schema || null))
    .digest("hex")
    .slice(0, 16);
}

export function classifyMcpTool(input: {
  name: string;
  description?: string;
  annotations?: Record<string, unknown>;
  adminOverride?: McpToolClassification | null;
}): McpToolClassification {
  if (input.adminOverride) return input.adminOverride;
  const ann = input.annotations || {};
  if (ann.readOnlyHint === true || ann["readOnlyHint"] === true) return "READ";
  if (ann.destructiveHint === true || ann["destructiveHint"] === true) {
    return "WRITE";
  }
  const text = `${input.name} ${input.description || ""}`.toLowerCase();
  if (
    /^(get_|list_|search_|find_|read_|fetch_|describe_|count_)/.test(input.name.toLowerCase()) ||
    /\b(get|list|search|find|read|fetch|describe|count)\b/.test(text)
  ) {
    // hints only — still UNKNOWN if write verbs present
    if (/\b(create|update|delete|remove|send|write|post|put|patch)\b/.test(text)) {
      return "UNKNOWN";
    }
    return "READ";
  }
  if (/\b(create|update|delete|remove|send|write)\b/.test(text)) return "WRITE";
  return "UNKNOWN";
}

export function upsertMcpTool(
  companyId: number,
  tool: McpToolDescriptor
): McpToolDescriptor {
  const t = table(companyId);
  const key = toolKey(tool.serverId, tool.name);
  const prev = t.get(key);
  const next = {
    ...tool,
    enabled: prev?.enabled ?? tool.enabled,
    capabilityOverride: prev?.capabilityOverride ?? tool.capabilityOverride,
    requiresConfirmation:
      prev?.requiresConfirmation ?? tool.requiresConfirmation,
    metadata: { ...(tool.metadata || {}), ...(prev?.metadata || {}) }
  };
  // preserve admin overrides on schema change
  if (prev && prev.schemaHash !== tool.schemaHash) {
    next.metadata = {
      ...next.metadata,
      previousSchemaHash: prev.schemaHash,
      schemaChanged: true
    };
  }
  t.set(key, next);
  return { ...next };
}

export function listMcpTools(
  companyId: number,
  serverId?: string
): McpToolDescriptor[] {
  return Array.from(table(companyId).values())
    .filter(t => (serverId ? t.serverId === serverId : true))
    .map(t => ({ ...t }));
}

export function getMcpTool(
  companyId: number,
  serverId: string,
  name: string
): McpToolDescriptor | null {
  const t = table(companyId).get(toolKey(serverId, name));
  return t ? { ...t } : null;
}

export function updateMcpToolOverrides(
  companyId: number,
  serverId: string,
  name: string,
  patch: Partial<
    Pick<
      McpToolDescriptor,
      | "enabled"
      | "requiresConfirmation"
      | "capabilityOverride"
      | "classification"
      | "metadata"
    >
  >
): McpToolDescriptor | null {
  const key = toolKey(serverId, name);
  const current = table(companyId).get(key);
  if (!current) return null;
  const next = { ...current, ...patch };
  table(companyId).set(key, next);
  return { ...next };
}

export function defaultEnabledForClassification(
  companyId: number,
  classification: McpToolClassification
): boolean {
  const cfg = getMcpConfig(companyId);
  if (classification === "READ") return cfg.readToolsDefaultEnabled;
  if (classification === "WRITE") return cfg.writeToolsDefaultEnabled;
  return cfg.unknownToolsDefaultEnabled;
}

export function __resetMcpToolsForTests(): void {
  toolsByCompany.clear();
}

export default {
  upsertMcpTool,
  listMcpTools,
  getMcpTool,
  classifyMcpTool
};
