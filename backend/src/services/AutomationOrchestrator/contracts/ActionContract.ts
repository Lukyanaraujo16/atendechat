import {
  AUTOMATION_ACTION_RUNTIME_VERSION,
  AutomationActionCategory,
  AutomationActionErrorCode,
  AutomationCapabilityId
} from "../../../config/automationOrchestratorConstants";
import { ActionNextHint, ActionResult, ExecutionContext } from "../types";

export type ActionInputType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "any";

export type ActionInputDecl = {
  name: string;
  type: ActionInputType;
  required?: boolean;
  description?: string;
};

export type ActionOutputDecl = {
  name: string;
  type: ActionInputType;
  description?: string;
};

export type ActionRetryPolicy = {
  retryable: boolean;
  maxRetries: number;
  backoffMs: number;
};

export type ActionManifest = {
  id: string;
  version: string;
  name: string;
  description: string;
  category: AutomationActionCategory;
  capabilities: AutomationCapabilityId[];
  inputs: ActionInputDecl[];
  outputs: ActionOutputDecl[];
  permissions: string[];
  timeoutMs: number;
  retryPolicy: ActionRetryPolicy;
  supportsObserve: boolean;
  supportsShadow: boolean;
  supportsActive: boolean;
  sideEffects: boolean;
  rollbackSupported: boolean;
  metricsEnabled: boolean;
  deprecated: boolean;
  experimental: boolean;
  owner: string;
  tags: string[];
  requiresCapabilities?: AutomationCapabilityId[];
  requiresFeatures?: string[];
  requiresContext?: string[];
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type ActionErrorContract = {
  code: AutomationActionErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};

export type ActionMetricsContract = {
  durationMs: number;
  attempts: number;
  timedOut: boolean;
  rolledBack: boolean;
  retries: number;
};

export type ActionOutputContract = {
  status: ActionResult["status"];
  outputs: Record<string, unknown>;
  metrics: ActionMetricsContract;
  logs: string[];
  nextHint?: ActionNextHint;
  errors: ActionErrorContract[];
  /** Compatibilidade com ActionResult legado. */
  message?: string;
  data?: Record<string, unknown>;
};

export type ActionRuntimeResult = ActionOutputContract & {
  /** Espelho legado para o Engine (sem mudança de branching). */
  legacyResult: ActionResult;
  manifest: ActionManifest;
};

export interface AutomationActionContract {
  /** Nome estável (compatível com PlanStep.actionName). */
  name: string;
  sideEffects?: boolean;
  supportsShadow?: boolean;
  supportsObserve?: boolean;
  supportsActive?: boolean;
  capability?: AutomationCapabilityId;

  manifest?(): ActionManifest;
  supports(ctx: ExecutionContext): boolean;
  validate(
    ctx: ExecutionContext,
    params?: Record<string, unknown>
  ): void | Promise<void>;
  prepare?(
    ctx: ExecutionContext,
    params?: Record<string, unknown>
  ): void | Promise<void>;
  execute(
    ctx: ExecutionContext,
    params?: Record<string, unknown>
  ): Promise<ActionResult>;
  rollback?(
    ctx: ExecutionContext,
    params?: Record<string, unknown>
  ): Promise<void>;
  cleanup?(
    ctx: ExecutionContext,
    params?: Record<string, unknown>
  ): void | Promise<void>;
}

export const DEFAULT_RETRY_POLICY: ActionRetryPolicy = {
  retryable: false,
  maxRetries: 0,
  backoffMs: 0
};

export function buildManifest(
  partial: Partial<ActionManifest> &
    Pick<ActionManifest, "id" | "name" | "category" | "capabilities">
): ActionManifest {
  const now = new Date().toISOString();
  return {
    id: partial.id,
    version: partial.version || "1.0.0",
    name: partial.name,
    description: partial.description || partial.name,
    category: partial.category,
    capabilities: partial.capabilities,
    inputs: partial.inputs || [],
    outputs: partial.outputs || [],
    permissions: partial.permissions || [],
    timeoutMs:
      partial.timeoutMs != null && Number.isFinite(partial.timeoutMs)
        ? Math.max(1, Number(partial.timeoutMs))
        : 15000,
    retryPolicy: {
      ...DEFAULT_RETRY_POLICY,
      ...(partial.retryPolicy || {})
    },
    supportsObserve: partial.supportsObserve !== false,
    supportsShadow: partial.supportsShadow !== false,
    supportsActive: partial.supportsActive !== false,
    sideEffects: partial.sideEffects === true,
    rollbackSupported: partial.rollbackSupported === true,
    metricsEnabled: partial.metricsEnabled !== false,
    deprecated: partial.deprecated === true,
    experimental: partial.experimental === true,
    owner: partial.owner || "atendechat.core",
    tags: Array.isArray(partial.tags) ? partial.tags : [],
    requiresCapabilities: partial.requiresCapabilities || [],
    requiresFeatures: partial.requiresFeatures || [],
    requiresContext: partial.requiresContext || [],
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    metadata: {
      runtimeVersion: AUTOMATION_ACTION_RUNTIME_VERSION,
      ...(partial.metadata || {})
    }
  };
}

export function synthesizeManifestFromLegacy(action: {
  name: string;
  sideEffects?: boolean;
  supportsShadow?: boolean;
  supportsObserve?: boolean;
  supportsActive?: boolean;
  capability?: AutomationCapabilityId;
  manifest?: () => ActionManifest;
}): ActionManifest {
  if (typeof action.manifest === "function") {
    return action.manifest();
  }
  const cap = action.capability || "planner";
  return buildManifest({
    id: action.name,
    name: action.name,
    category: "system",
    capabilities: [cap],
    description: `Legacy action ${action.name}`,
    sideEffects: action.sideEffects === true,
    supportsShadow: action.supportsShadow !== false,
    supportsObserve: action.supportsObserve !== false,
    supportsActive: action.supportsActive !== false,
    owner: "atendechat.legacy",
    tags: ["legacy-synthesized"]
  });
}

export function toLegacyActionResult(
  output: ActionOutputContract
): ActionResult {
  return {
    status: output.status,
    message: output.message || output.errors[0]?.message,
    data: {
      ...(output.data || {}),
      ...(output.outputs || {}),
      __runtime: {
        metrics: output.metrics,
        errors: output.errors,
        logs: output.logs
      }
    },
    nextHint: output.nextHint
  };
}

export function classifyActionError(
  err: unknown,
  fallback: AutomationActionErrorCode = "unexpected"
): ActionErrorContract {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "ACTION_TIMEOUT") {
    return { code: "timeout", message, retryable: true };
  }
  if (message.startsWith("ACTION_VALIDATION:")) {
    return {
      code: "validation",
      message: message.replace(/^ACTION_VALIDATION:/, "").trim() || message,
      retryable: false
    };
  }
  if (message.startsWith("ACTION_PERMISSION:")) {
    return { code: "permission", message, retryable: false };
  }
  if (message.startsWith("ACTION_CAPABILITY:")) {
    return { code: "capability", message, retryable: false };
  }
  return { code: fallback, message: message.slice(0, 500), retryable: false };
}
