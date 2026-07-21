import {
  FcPlannerCategory,
  categoryFromToolId,
  isFcEligibleToolId
} from "../../../../config/automationFunctionCallingConstants";
import {
  isWriteSideEffect,
  ToolInvocationSource
} from "../../../../config/automationToolConstants";
import { ToolManifest } from "../contracts/ToolContract";
import { ToolExecutionContext } from "../ToolExecutionContext";
import { discoverTools, listTools } from "../ToolRegistry";
import { evaluateToolPolicy } from "../AutomationToolPolicyEngine";
import { buildToolAllowlist } from "../ToolAllowlist";
import { registerBuiltinTools } from "../registerBuiltinTools";

export type ToolSelectionInput = {
  ctx: ToolExecutionContext;
  companyPolicy?: {
    enabled?: boolean;
    maxRiskLevel?: string;
    allowWrite?: boolean;
    deniedToolIds?: string[];
    allowedToolIds?: string[] | null;
  } | null;
  provider?: "openai" | "gemini" | "claude" | string;
  /** Categorias sugeridas pelo planner (opcional). */
  plannerCategories?: FcPlannerCategory[];
  /** Origem explícita do FC. */
  origin: "simulator" | "admin_test" | "shadow" | "live";
};

export type ToolSelectionResult = {
  tools: ToolManifest[];
  allowlist: Array<{ id: string; version: string; key: string }>;
  allowedToolKeys: string[];
  rejected: Array<{ id: string; reason: string }>;
  provider: string;
  origin: string;
};

const FC_ORIGINS: ToolInvocationSource[] = [
  "simulator",
  "admin_test",
  "shadow",
  "live"
];

/**
 * Selection Engine — nunca expõe o Registry completo ao modelo.
 * Somente Tools elegíveis (read / exposeToModel / policy).
 */
export function selectToolsForFunctionCalling(
  input: ToolSelectionInput
): ToolSelectionResult {
  registerBuiltinTools();

  const rejected: Array<{ id: string; reason: string }> = [];
  const provider = String(input.provider || "openai").toLowerCase();

  if (!FC_ORIGINS.includes(input.origin)) {
    return {
      tools: [],
      allowlist: [],
      allowedToolKeys: [],
      rejected: [{ id: "*", reason: `origin_not_allowed:${input.origin}` }],
      provider,
      origin: input.origin
    };
  }

  // Claude preparado, não implementado nesta fase
  if (provider === "claude") {
    return {
      tools: [],
      allowlist: [],
      allowedToolKeys: [],
      rejected: [{ id: "*", reason: "provider_claude_not_implemented" }],
      provider,
      origin: input.origin
    };
  }

  const candidates = listTools({
    includeExperimental: false,
    includeDeprecated: false
  });

  const categorySet =
    Array.isArray(input.plannerCategories) && input.plannerCategories.length
      ? new Set(input.plannerCategories)
      : null;

  const selected: ToolManifest[] = [];

  for (const m of candidates) {
    if (m.exposeToModel !== true) {
      rejected.push({ id: m.id, reason: "not_exposed_to_model" });
      continue;
    }
    if (m.deprecated) {
      rejected.push({ id: m.id, reason: "deprecated" });
      continue;
    }
    if (m.experimental) {
      rejected.push({ id: m.id, reason: "experimental_blocked" });
      continue;
    }
    if (!isFcEligibleToolId(m.id)) {
      rejected.push({ id: m.id, reason: "not_in_fc_allowlist_patterns" });
      continue;
    }
    if (isWriteSideEffect(m.sideEffectType)) {
      rejected.push({ id: m.id, reason: "write_side_effect_blocked" });
      continue;
    }
    if (m.riskLevel !== "read_only") {
      rejected.push({ id: m.id, reason: "risk_not_read_only" });
      continue;
    }

    const cat = categoryFromToolId(m.id);
    if (categorySet && cat && !categorySet.has(cat)) {
      rejected.push({ id: m.id, reason: `planner_category_filtered:${cat}` });
      continue;
    }

    // Discovery contextual (não é gate de execução, mas alinha capabilities)
    const discovered = discoverTools({
      ctx: input.ctx,
      requireExposeToModel: true,
      capabilities: m.capabilities,
      includeExperimental: false,
      includeDeprecated: false
    }).some(d => d.id === m.id);
    if (!discovered && (m.capabilities || []).length) {
      // se discovery filtrar por capability inativa no ctx, rejeita
      const caps = m.capabilities || [];
      const anyActive = caps.some(c => input.ctx.capabilities?.[c] === true);
      if (!anyActive && input.ctx.controlMode === "active_partial") {
        rejected.push({ id: m.id, reason: "capability_inactive" });
        continue;
      }
    }

    const decision = evaluateToolPolicy({
      manifest: m,
      ctx: input.ctx,
      companyPolicy: {
        enabled: input.companyPolicy?.enabled !== false,
        maxRiskLevel: (input.companyPolicy?.maxRiskLevel as any) || "read_only",
        allowWrite: false,
        deniedToolIds: input.companyPolicy?.deniedToolIds || [],
        allowedToolIds: input.companyPolicy?.allowedToolIds ?? null
      }
    });

    if (!decision.allowed) {
      rejected.push({ id: m.id, reason: decision.reason });
      continue;
    }

    selected.push(m);
  }

  const allowlist = buildToolAllowlist(selected);
  return {
    tools: selected,
    allowlist,
    allowedToolKeys: allowlist.map(a => a.key),
    rejected,
    provider,
    origin: input.origin
  };
}

export default { selectToolsForFunctionCalling };
