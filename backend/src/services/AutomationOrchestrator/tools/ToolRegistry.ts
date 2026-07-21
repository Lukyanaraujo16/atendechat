import { ToolCapabilityKey } from "../../../config/automationToolConstants";
import {
  AutomationToolContract,
  ToolManifest
} from "./contracts/ToolContract";
import { ToolExecutionContext } from "./ToolExecutionContext";

type RegistryEntry = {
  tool: AutomationToolContract;
  versions: Map<string, AutomationToolContract>;
};

const registry = new Map<string, RegistryEntry>();

function resolveManifest(tool: AutomationToolContract): ToolManifest {
  return tool.manifest();
}

export function validateToolManifest(manifest: ToolManifest): string[] {
  const errors: string[] = [];
  if (!manifest.id) errors.push("manifest.id_required");
  if (!manifest.name) errors.push("manifest.name_required");
  if (!manifest.version) errors.push("manifest.version_required");
  if (!manifest.category) errors.push("manifest.category_required");
  if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.length) {
    errors.push("manifest.capabilities_required");
  }
  if (!manifest.riskLevel) errors.push("manifest.riskLevel_required");
  if (!manifest.sideEffectType) errors.push("manifest.sideEffectType_required");
  if (!manifest.inputSchema) errors.push("manifest.inputSchema_required");
  if (!manifest.outputSchema) errors.push("manifest.outputSchema_required");
  if (
    !manifest.timeoutPolicy ||
    !Number.isFinite(manifest.timeoutPolicy.timeoutMs) ||
    manifest.timeoutPolicy.timeoutMs < 1
  ) {
    errors.push("manifest.timeout_invalid");
  }
  if (!manifest.idempotencyPolicy?.type) {
    errors.push("manifest.idempotency_required");
  }
  const writeEffects = ["database_write", "message_send", "external_request", "financial", "destructive"];
  if (
    writeEffects.includes(manifest.sideEffectType) &&
    manifest.idempotencyPolicy?.type === "none"
  ) {
    errors.push("manifest.write_requires_idempotency");
  }
  return errors;
}

export function registerTool(tool: AutomationToolContract): void {
  if (!tool || typeof tool.execute !== "function" || typeof tool.manifest !== "function") {
    throw new Error("TOOL_REGISTRY: invalid_tool");
  }
  const manifest = resolveManifest(tool);
  const errors = validateToolManifest(manifest);
  if (errors.length) {
    throw new Error(`TOOL_REGISTRY: invalid_manifest:${errors.join(",")}`);
  }

  const existing = registry.get(manifest.id);
  if (!existing) {
    const versions = new Map<string, AutomationToolContract>();
    versions.set(manifest.version, tool);
    registry.set(manifest.id, { tool, versions });
    return;
  }

  if (existing.versions.has(manifest.version)) {
    throw new Error(
      `TOOL_REGISTRY: duplicate:${manifest.id}@${manifest.version}`
    );
  }

  existing.versions.set(manifest.version, tool);
  existing.tool = tool;
}

export function getTool(id: string): AutomationToolContract | undefined {
  return registry.get(id)?.tool;
}

export function getToolVersion(
  id: string,
  version: string
): AutomationToolContract | undefined {
  return registry.get(id)?.versions.get(version);
}

export function listTools(opts?: {
  includeExperimental?: boolean;
  includeDeprecated?: boolean;
}): ToolManifest[] {
  const includeExperimental = opts?.includeExperimental !== false;
  const includeDeprecated = opts?.includeDeprecated === true;

  return Array.from(registry.values())
    .map(e => resolveManifest(e.tool))
    .filter(m => {
      if (!includeDeprecated && m.deprecated) return false;
      if (!includeExperimental && m.experimental) return false;
      return true;
    });
}

export function listToolVersions(id: string): string[] {
  const entry = registry.get(id);
  if (!entry) return [];
  return Array.from(entry.versions.keys());
}

export function listToolsByCapability(
  capability: ToolCapabilityKey | string
): ToolManifest[] {
  return listTools({ includeExperimental: true, includeDeprecated: true }).filter(
    m => m.capabilities.map(String).includes(String(capability))
  );
}

export function listToolsByCategory(category: string): ToolManifest[] {
  return listTools({ includeExperimental: true, includeDeprecated: true }).filter(
    m => m.category === category
  );
}

export function getToolManifest(id: string): ToolManifest | undefined {
  const tool = getTool(id);
  return tool ? resolveManifest(tool) : undefined;
}

export type ToolDiscoveryFilter = {
  ctx: ToolExecutionContext;
  includeExperimental?: boolean;
  includeDeprecated?: boolean;
  requireExposeToModel?: boolean;
  capabilities?: string[];
  category?: string;
};

/**
 * Discovery contextual — NÃO executa Tool.
 * supportsDiscovery() filtra catálogo; não autoriza execução.
 */
export function discoverTools(filter: ToolDiscoveryFilter): ToolManifest[] {
  const {
    ctx,
    includeExperimental = false,
    includeDeprecated = false,
    requireExposeToModel = false,
    capabilities,
    category
  } = filter;

  return Array.from(registry.values())
    .map(e => e.tool)
    .filter(tool => {
      const m = resolveManifest(tool);
      if (!includeDeprecated && m.deprecated) return false;
      if (!includeExperimental && m.experimental) return false;
      if (requireExposeToModel && !m.exposeToModel) return false;
      if (category && m.category !== category) return false;
      if (capabilities?.length) {
        const has = capabilities.some(c =>
          m.capabilities.map(String).includes(String(c))
        );
        if (!has) return false;
      }
      if (typeof tool.supportsDiscovery === "function") {
        try {
          if (!tool.supportsDiscovery(ctx)) return false;
        } catch {
          return false;
        }
      }
      return true;
    })
    .map(t => resolveManifest(t));
}

export function clearToolRegistry(): void {
  registry.clear();
}

export function toolRegistrySize(): number {
  return registry.size;
}

export default {
  registerTool,
  getTool,
  getToolVersion,
  listTools,
  listToolVersions,
  listToolsByCapability,
  listToolsByCategory,
  getToolManifest,
  validateToolManifest,
  discoverTools,
  clearToolRegistry,
  toolRegistrySize
};
