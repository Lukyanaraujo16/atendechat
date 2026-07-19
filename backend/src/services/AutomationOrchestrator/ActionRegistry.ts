import {
  ActionManifest,
  AutomationActionContract,
  buildManifest
} from "./contracts/ActionContract";
import { ActionResult, ExecutionContext } from "./types";
import { hasCapability } from "./CapabilityRegistry";

export type AutomationAction = AutomationActionContract;

type RegistryEntry = {
  action: AutomationAction;
  versions: Map<string, AutomationAction>;
};

const registry = new Map<string, RegistryEntry>();

function resolveManifest(action: AutomationAction): ActionManifest {
  if (typeof action.manifest === "function") {
    return action.manifest();
  }
  return buildManifest({
    id: action.name,
    name: action.name,
    category: "system",
    capabilities: [action.capability || "planner"],
    sideEffects: action.sideEffects === true,
    supportsShadow: action.supportsShadow !== false,
    supportsObserve: action.supportsObserve !== false,
    supportsActive: action.supportsActive !== false
  });
}

export function validateActionManifest(manifest: ActionManifest): string[] {
  const errors: string[] = [];
  if (!manifest.id) errors.push("manifest.id_required");
  if (!manifest.name) errors.push("manifest.name_required");
  if (!manifest.version) errors.push("manifest.version_required");
  if (!manifest.category) errors.push("manifest.category_required");
  if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.length) {
    errors.push("manifest.capabilities_required");
  }
  if (
    manifest.timeoutMs == null ||
    !Number.isFinite(manifest.timeoutMs) ||
    manifest.timeoutMs < 1
  ) {
    errors.push("manifest.timeout_invalid");
  }
  for (const cap of manifest.capabilities || []) {
    if (!hasCapability(cap) && !String(cap).startsWith("future.")) {
      // allow unknown custom caps for plugins; warn via error list soft
      if (!cap) errors.push("manifest.capability_empty");
    }
  }
  return errors;
}

export function registerAction(action: AutomationAction): void {
  if (!action?.name || typeof action.execute !== "function") {
    throw new Error("ACTION_REGISTRY: invalid_action");
  }
  const manifest = resolveManifest(action);
  const errors = validateActionManifest(manifest);
  if (errors.length) {
    throw new Error(`ACTION_REGISTRY: invalid_manifest:${errors.join(",")}`);
  }

  const existing = registry.get(action.name);
  if (!existing) {
    const versions = new Map<string, AutomationAction>();
    versions.set(manifest.version, action);
    registry.set(action.name, { action, versions });
    return;
  }

  existing.versions.set(manifest.version, action);
  // versão mais recente no slot principal (semântica simples)
  existing.action = action;
}

export function getAction(name: string): AutomationAction | undefined {
  return registry.get(name)?.action;
}

export function getActionVersion(
  name: string,
  version: string
): AutomationAction | undefined {
  return registry.get(name)?.versions.get(version);
}

export function listActions(): string[] {
  return Array.from(registry.keys());
}

export function listActionManifests(): ActionManifest[] {
  return Array.from(registry.values()).map(e => resolveManifest(e.action));
}

export function listActionsByCapability(
  capability: string
): AutomationAction[] {
  return Array.from(registry.values())
    .map(e => e.action)
    .filter(a => {
      const m = resolveManifest(a);
      return m.capabilities.map(String).includes(String(capability));
    });
}

export function listActionsByCategory(category: string): AutomationAction[] {
  return Array.from(registry.values())
    .map(e => e.action)
    .filter(a => resolveManifest(a).category === category);
}

export function listActionVersions(name: string): string[] {
  const entry = registry.get(name);
  if (!entry) return [];
  return Array.from(entry.versions.keys());
}

/** Discovery para o Planner: quem executa capability X? */
export function discoverActionsForCapability(capability: string): Array<{
  name: string;
  version: string;
  id: string;
  category: string;
}> {
  return listActionsByCapability(capability).map(a => {
    const m = resolveManifest(a);
    return {
      name: m.name,
      version: m.version,
      id: m.id,
      category: m.category
    };
  });
}

export function getActionManifest(name: string): ActionManifest | undefined {
  const action = getAction(name);
  if (!action) return undefined;
  return resolveManifest(action);
}

export function clearActionRegistry(): void {
  registry.clear();
}

export type { ActionResult, ExecutionContext };

export default {
  registerAction,
  getAction,
  getActionVersion,
  listActions,
  listActionManifests,
  listActionsByCapability,
  listActionsByCategory,
  listActionVersions,
  discoverActionsForCapability,
  getActionManifest,
  validateActionManifest,
  clearActionRegistry
};
