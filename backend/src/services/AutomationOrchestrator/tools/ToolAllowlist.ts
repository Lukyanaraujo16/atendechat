import { ToolManifest } from "./contracts/ToolContract";

/**
 * Allowlist de discovery seguro.
 * O nome vindo do modelo NÃO é confiável.
 * Resolver apenas Tools previamente expostas nesta execução.
 */
export function buildToolAllowlist(
  manifests: ToolManifest[]
): Array<{ id: string; version: string; key: string }> {
  return manifests.map(m => ({
    id: m.id,
    version: m.version,
    key: `${m.id}@${m.version}`
  }));
}

export function toolAllowlistKeys(manifests: ToolManifest[]): string[] {
  return buildToolAllowlist(manifests).map(e => e.key);
}

export function resolveToolFromAllowlist(input: {
  requestedId: string;
  requestedVersion?: string | null;
  allowlist: Array<{ id: string; version: string; key: string }>;
}): { id: string; version: string; key: string } | null {
  const id = String(input.requestedId || "").trim();
  if (!id) return null;

  const version = input.requestedVersion
    ? String(input.requestedVersion).trim()
    : null;

  if (version) {
    const key = `${id}@${version}`;
    return input.allowlist.find(e => e.key === key) || null;
  }

  // Sem versão: somente se houver exatamente uma entrada do id na allowlist.
  const matches = input.allowlist.filter(e => e.id === id);
  if (matches.length === 1) return matches[0];
  return null;
}

/**
 * Nunca faz discovery global do Registry para o modelo.
 */
export function assertToolInAllowlist(input: {
  toolId: string;
  toolVersion: string;
  allowedToolKeys?: string[] | null;
}): void {
  if (!input.allowedToolKeys || input.allowedToolKeys.length === 0) {
    throw new Error("TOOL_POLICY: model_allowlist_required");
  }
  const key = `${input.toolId}@${input.toolVersion}`;
  if (!input.allowedToolKeys.includes(key)) {
    throw new Error("TOOL_POLICY: tool_not_in_execution_allowlist");
  }
}
