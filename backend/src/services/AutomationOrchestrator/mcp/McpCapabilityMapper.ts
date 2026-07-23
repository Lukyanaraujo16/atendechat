import { RuntimeCapabilityKind } from "../../../config/automationRuntimeIntegrationConstants";
import { McpToolDescriptor } from "./types";

const NAME_MAP: Array<{ pattern: RegExp; capability: string }> = [
  { pattern: /search[_-]?customer|customer[_-]?search/i, capability: "SEARCH_CUSTOMER" },
  { pattern: /search[_-]?contact|contact[_-]?search/i, capability: "SEARCH_CONTACT" },
  { pattern: /search[_-]?ticket|ticket[_-]?search/i, capability: "SEARCH_TICKET" },
  { pattern: /knowledge|search[_-]?kb/i, capability: "SEARCH_KNOWLEDGE" },
  { pattern: /calendar|create[_-]?event/i, capability: "CREATE_CALENDAR_EVENT" },
  { pattern: /send[_-]?email|email[_-]?send/i, capability: "SEND_EMAIL" },
  { pattern: /transfer/i, capability: "TRANSFER_TICKET" },
  { pattern: /update|patch/i, capability: "UPDATE_ENTITY" },
  { pattern: /message|note/i, capability: "SEND_MESSAGE" }
];

/**
 * McpCapabilityMapper — MCP Tool → RuntimeCapability (determinístico).
 */
export function mapMcpToolToCapability(
  tool: McpToolDescriptor
): string {
  if (tool.capabilityOverride) return tool.capabilityOverride;

  for (const rule of NAME_MAP) {
    if (rule.pattern.test(tool.name) || rule.pattern.test(tool.description)) {
      return rule.capability;
    }
  }

  const schemaKeys = Object.keys(
    ((tool.inputSchema as any)?.properties as object) || {}
  ).join(" ");
  for (const rule of NAME_MAP) {
    if (rule.pattern.test(schemaKeys)) return rule.capability;
  }

  return "CUSTOM_OPERATION";
}

export function findMcpToolForCapability(input: {
  tools: McpToolDescriptor[];
  capability: string;
}): McpToolDescriptor | null {
  const enabled = input.tools.filter(t => t.enabled);
  const exact = enabled.find(
    t =>
      (t.capabilityOverride || mapMcpToolToCapability(t)) === input.capability
  );
  return exact || null;
}

export function toRuntimeCapabilityKind(capability: string): RuntimeCapabilityKind | string {
  return capability;
}

export default { mapMcpToolToCapability, findMcpToolForCapability };
