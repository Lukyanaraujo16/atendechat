import {
  AUTOMATION_AI_TOOLS_FEATURE_KEY,
  AUTOMATION_TOOL_PRODUCTIVE_SOURCES,
  isWriteSideEffect,
  ToolInvocationSource,
  ToolRiskLevel,
  ToolSideEffectType
} from "../../../config/automationToolConstants";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../../../config/automationOrchestratorConstants";
import { ToolManifest } from "./contracts/ToolContract";
import { ToolExecutionContext } from "./ToolExecutionContext";

export type ToolPolicyDecision = {
  allowed: boolean;
  reason: string;
  requireConfirmation: boolean;
  requireOwnership: boolean;
  requireIdempotency: boolean;
  effectiveMode: string;
  permissionDecision: string;
  featureDecision: string;
  fallback: "deny" | "none";
};

function hasPermission(
  ctx: ToolExecutionContext,
  required: string[]
): boolean {
  if (!required.length) return true;
  const perms = new Set((ctx.permissions || []).map(String));
  // Admin/support em teste: permissões granulares podem ser sintetizadas pelo controller.
  return required.every(p => perms.has(p));
}

function hasFeatures(
  ctx: ToolExecutionContext,
  required: string[]
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const key of required) {
    if (ctx.featureFlags?.[key] !== true) missing.push(key);
  }
  return { ok: missing.length === 0, missing };
}

function riskAllowed(
  risk: ToolRiskLevel,
  maxRisk: ToolRiskLevel | undefined
): boolean {
  if (!maxRisk) return risk === "read_only" || risk === "low";
  const order: ToolRiskLevel[] = [
    "read_only",
    "low",
    "medium",
    "high",
    "critical"
  ];
  return order.indexOf(risk) <= order.indexOf(maxRisk);
}

function sideEffectAllowedInMode(
  sideEffect: ToolSideEffectType,
  controlMode: string,
  supportsShadow: boolean
): { ok: boolean; reason: string } {
  if (controlMode === "disabled") {
    return { ok: false, reason: "control_mode_disabled" };
  }
  if (controlMode === "observe") {
    // Observe: somente planning/discovery — nunca executar.
    return { ok: false, reason: "observe_no_execution" };
  }
  if (controlMode === "shadow_execute") {
    if (!supportsShadow) {
      return { ok: false, reason: "shadow_not_supported" };
    }
    if (isWriteSideEffect(sideEffect)) {
      return { ok: false, reason: "shadow_no_side_effect" };
    }
    if (sideEffect !== "none" && sideEffect !== "database_read") {
      return { ok: false, reason: "shadow_side_effect_blocked" };
    }
    return { ok: true, reason: "shadow_read_ok" };
  }
  if (controlMode === "active_partial" || controlMode === "active") {
    return { ok: true, reason: "active_ok" };
  }
  return { ok: false, reason: "unknown_control_mode" };
}

/**
 * Policy Engine separado do Runtime.
 * Decide; não executa.
 */
export function evaluateToolPolicy(input: {
  manifest: ToolManifest;
  ctx: ToolExecutionContext;
  companyPolicy?: {
    enabled?: boolean;
    maxRiskLevel?: ToolRiskLevel;
    allowWrite?: boolean;
    requireConfirmationFor?: ToolRiskLevel[];
    deniedToolIds?: string[];
    allowedToolIds?: string[] | null;
  } | null;
}): ToolPolicyDecision {
  const { manifest, ctx, companyPolicy } = input;
  const deny = (
    reason: string,
    extras?: Partial<ToolPolicyDecision>
  ): ToolPolicyDecision => ({
    allowed: false,
    reason,
    requireConfirmation: false,
    requireOwnership: false,
    requireIdempotency: isWriteSideEffect(manifest.sideEffectType),
    effectiveMode: ctx.controlMode,
    permissionDecision: extras?.permissionDecision || "n/a",
    featureDecision: extras?.featureDecision || "n/a",
    fallback: "deny"
  });

  if (companyPolicy?.enabled === false) {
    return deny("company_policy_disabled");
  }

  if (companyPolicy?.deniedToolIds?.includes(manifest.id)) {
    return deny("tool_denied_by_policy");
  }

  if (
    Array.isArray(companyPolicy?.allowedToolIds) &&
    companyPolicy!.allowedToolIds!.length > 0 &&
    !companyPolicy!.allowedToolIds!.includes(manifest.id)
  ) {
    return deny("tool_not_in_allowlist_policy");
  }

  // Origem: nesta fase só action e admin_test executam.
  if (!AUTOMATION_TOOL_PRODUCTIVE_SOURCES.includes(ctx.source)) {
    return deny(`source_not_productive:${ctx.source}`);
  }

  if (ctx.source === "admin_test" && ctx.adminTestMode !== true) {
    return deny("admin_test_mode_required");
  }

  // Admin tester: leitura livre; escrita só em preview/dry_run/execute explícito.
  if (ctx.source === "admin_test" && isWriteSideEffect(manifest.sideEffectType)) {
    const writeMode = String(ctx.metadata?.writeMode || "");
    if (!["preview", "dry_run", "execute"].includes(writeMode)) {
      return deny("admin_test_write_mode_required");
    }
    if (writeMode === "execute" && companyPolicy?.allowWrite !== true) {
      return deny("admin_test_execute_requires_allow_write");
    }
  }

  // Simulador Function Calling: somente leitura; nunca escrita.
  if (ctx.source === "simulator") {
    if (isWriteSideEffect(manifest.sideEffectType)) {
      return deny("simulator_no_write");
    }
    if (manifest.riskLevel !== "read_only") {
      return deny("simulator_read_only_only");
    }
    if (manifest.exposeToModel !== true) {
      return deny("simulator_not_exposed");
    }
  }

  const featureRequired = [
    AUTOMATION_ORCHESTRATOR_FEATURE_KEY,
    AUTOMATION_AI_TOOLS_FEATURE_KEY,
    ...(manifest.requiredFeatures || [])
  ];
  const features = hasFeatures(ctx, featureRequired);
  if (!features.ok) {
    return deny(`feature_missing:${features.missing.join(",")}`, {
      featureDecision: "denied"
    });
  }

  const permOk = hasPermission(ctx, manifest.requiredPermissions || []);
  if (!permOk) {
    return deny("permission_denied", { permissionDecision: "denied" });
  }

  // active_partial: capabilities explicitamente ativas
  if (ctx.controlMode === "active_partial") {
    const caps = manifest.capabilities || [];
    const activeCaps = caps.filter(c => ctx.capabilities?.[c] === true);
    if (!caps.length || activeCaps.length === 0) {
      return deny("active_partial_capability_inactive");
    }
  }

  // Capabilities da Tool (quando declaradas no contexto)
  for (const cap of manifest.capabilities || []) {
    if (ctx.capabilities && Object.prototype.hasOwnProperty.call(ctx.capabilities, cap)) {
      if (ctx.capabilities[cap] !== true && ctx.controlMode === "active") {
        return deny(`capability_inactive:${cap}`);
      }
    }
  }

  const modeGate = sideEffectAllowedInMode(
    manifest.sideEffectType,
    ctx.controlMode,
    manifest.supportsShadow
  );
  if (!modeGate.ok) {
    return deny(modeGate.reason);
  }

  if (!riskAllowed(manifest.riskLevel, companyPolicy?.maxRiskLevel)) {
    return deny(`risk_exceeded:${manifest.riskLevel}`);
  }

  // Escrita exige policy explícita (deny-by-default), exceto preview/dry_run no admin tester.
  if (
    isWriteSideEffect(manifest.sideEffectType) &&
    companyPolicy?.allowWrite !== true
  ) {
    const writeMode = String(ctx.metadata?.writeMode || "");
    if (
      !(
        ctx.source === "admin_test" &&
        (writeMode === "preview" || writeMode === "dry_run")
      )
    ) {
      return deny("write_not_explicitly_allowed");
    }
  }

  const requireOwnership =
    manifest.requiresOwnership === true ||
    (isWriteSideEffect(manifest.sideEffectType) &&
      ctx.executionOwner !== "orchestrator");

  if (requireOwnership && manifest.requiresOwnership) {
    if (ctx.executionOwner !== "orchestrator") {
      return deny("ownership_required");
    }
  }

  const requireIdempotency = isWriteSideEffect(manifest.sideEffectType);
  if (requireIdempotency && manifest.idempotencyPolicy.type === "none") {
    return deny("write_without_idempotency");
  }

  let requireConfirmation = false;
  if (manifest.requiresConfirmation && manifest.requiresConfirmation !== "never") {
    requireConfirmation = true;
  }
  if (
    companyPolicy?.requireConfirmationFor?.includes(manifest.riskLevel)
  ) {
    requireConfirmation = true;
  }

  // Confirmação de escrita: Operation Runtime gera preview e waiting_confirmation.
  if (
    requireConfirmation &&
    isWriteSideEffect(manifest.sideEffectType) &&
    manifest.metadata?.operationRuntime !== true
  ) {
    const confStatus = ctx.metadata?.confirmationStatus;
    if (confStatus !== "approved") {
      return {
        allowed: false,
        reason: "confirmation_required",
        requireConfirmation: true,
        requireOwnership: manifest.requiresOwnership,
        requireIdempotency,
        effectiveMode: ctx.controlMode,
        permissionDecision: "allowed",
        featureDecision: "allowed",
        fallback: "deny"
      };
    }
  }

  return {
    allowed: true,
    reason: "allowed",
    requireConfirmation,
    requireOwnership: manifest.requiresOwnership,
    requireIdempotency,
    effectiveMode: ctx.controlMode,
    permissionDecision: "allowed",
    featureDecision: "allowed",
    fallback: "none"
  };
}

export function isSourceProductive(source: ToolInvocationSource): boolean {
  return AUTOMATION_TOOL_PRODUCTIVE_SOURCES.includes(source);
}

export default {
  evaluateToolPolicy,
  isSourceProductive
};
