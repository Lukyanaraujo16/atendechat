import {
  AUTOMATION_TOOL_RUNTIME_VERSION,
  AUTOMATION_TOOL_TECHNICAL_RATE_LIMIT,
  ToolCategory,
  ToolCapabilityKey,
  ToolConfirmationPolicy,
  ToolErrorType,
  ToolIdempotencyType,
  ToolRateLimitScope,
  ToolRiskLevel,
  ToolSideEffectType,
  AutomationToolStatus
} from "../../../../config/automationToolConstants";
import { ToolExecutionContext } from "../ToolExecutionContext";

export type ToolSchemaFieldType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "any";

export type ToolSchemaField = {
  name: string;
  type: ToolSchemaFieldType;
  required?: boolean;
  description?: string;
  enum?: Array<string | number | boolean>;
  properties?: ToolSchemaField[];
  items?: ToolSchemaField;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};

export type ToolInputSchema = {
  type: "object";
  fields: ToolSchemaField[];
  additionalProperties?: boolean;
};

export type ToolOutputSchema = {
  type: "object";
  fields: ToolSchemaField[];
  additionalProperties?: boolean;
};

export type ToolTimeoutPolicy = {
  timeoutMs: number;
};

export type ToolRetryPolicy = {
  retryable: boolean;
  maxRetries: number;
  backoffMs: number;
};

export type ToolIdempotencyPolicy = {
  type: ToolIdempotencyType;
  /** Campo em input/context para tipo custom. */
  customKeyField?: string;
  /** Exigir constraint persistente além do lock Redis. */
  persistentUniqueness?: boolean;
};

export type ToolRateLimitPolicy = {
  maxCalls: number;
  windowSeconds: number;
  scope: ToolRateLimitScope;
};

export type ToolManifest = {
  id: string;
  version: string;
  name: string;
  description: string;
  category: ToolCategory;
  capabilities: ToolCapabilityKey[];
  inputSchema: ToolInputSchema;
  outputSchema: ToolOutputSchema;
  requiredPermissions: string[];
  requiredFeatures: string[];
  requiredContext: string[];
  riskLevel: ToolRiskLevel;
  sideEffectType: ToolSideEffectType;
  supportsObserve: boolean;
  supportsShadow: boolean;
  supportsActive: boolean;
  requiresOwnership: boolean;
  requiresConfirmation: ToolConfirmationPolicy;
  idempotencyPolicy: ToolIdempotencyPolicy;
  timeoutPolicy: ToolTimeoutPolicy;
  retryPolicy: ToolRetryPolicy;
  rateLimitPolicy: ToolRateLimitPolicy;
  auditEnabled: boolean;
  metricsEnabled: boolean;
  experimental: boolean;
  deprecated: boolean;
  /** Tools técnicas não são expostas ao modelo. */
  exposeToModel: boolean;
  owner: string;
  tags: string[];
  metadata: Record<string, unknown>;
};

export type ToolError = {
  code: string;
  type: ToolErrorType;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export type ToolAuditMetadata = {
  requestedBy?: string | number | null;
  source: string;
  companyId: number;
  toolId: string;
  toolVersion: string;
  controlMode?: string;
  ownership?: string | null;
  policyDecision?: string;
  permissionDecision?: string;
  featureDecision?: string;
  attemptCount?: number;
  durationMs?: number;
  correlationId?: string | null;
  sideEffectCommitted?: boolean;
  rollbackStatus?: string;
};

export type ToolResult = {
  status: AutomationToolStatus;
  data: Record<string, unknown>;
  displayData: Record<string, unknown>;
  metrics: {
    durationMs: number;
    attempts: number;
    timedOut: boolean;
    retries: number;
    rolledBack: boolean;
    resultCount?: number;
    emptyResult?: boolean;
    cacheHit?: boolean;
    cacheMiss?: boolean;
  };
  logs: string[];
  warnings: string[];
  errors: ToolError[];
  idempotencyKey: string | null;
  executionId: string | null;
  sideEffectCommitted: boolean;
  rollbackAvailable: boolean;
  confirmationStatus?: string;
  audit?: ToolAuditMetadata;
  /** Payload preferencial para toModelResult (opcional). */
  modelPayload?: Record<string, unknown>;
  /** Preenchido pelo Runtime — nunca montado pela Tool diretamente. */
  modelResult?: Record<string, unknown>;
};

export interface AutomationToolContract {
  manifest(): ToolManifest;
  /** Discovery/catálogo — NÃO é gate operacional. */
  supportsDiscovery?(ctx: ToolExecutionContext): boolean;
  /** Gate operacional de contexto (separado de discovery). */
  validateExecutionContext?(
    ctx: ToolExecutionContext
  ): void | Promise<void>;
  prepare?(
    ctx: ToolExecutionContext,
    input: Record<string, unknown>
  ): void | Promise<void>;
  execute(
    ctx: ToolExecutionContext,
    input: Record<string, unknown>
  ): Promise<ToolResult>;
  rollback?(
    ctx: ToolExecutionContext,
    input: Record<string, unknown>
  ): Promise<void>;
  cleanup?(
    ctx: ToolExecutionContext,
    input: Record<string, unknown>
  ): void | Promise<void>;
  sanitizeInputForAudit?(
    input: Record<string, unknown>
  ): Record<string, unknown>;
  sanitizeOutputForAudit?(
    output: Record<string, unknown>
  ): Record<string, unknown>;
}

export const DEFAULT_TOOL_RETRY_POLICY: ToolRetryPolicy = {
  retryable: false,
  maxRetries: 0,
  backoffMs: 0
};

export const DEFAULT_TOOL_IDEMPOTENCY: ToolIdempotencyPolicy = {
  type: "none",
  persistentUniqueness: false
};

export const EMPTY_OBJECT_SCHEMA: ToolInputSchema = {
  type: "object",
  fields: [],
  additionalProperties: false
};

export function buildToolManifest(
  partial: Partial<ToolManifest> &
    Pick<
      ToolManifest,
      | "id"
      | "name"
      | "category"
      | "capabilities"
      | "riskLevel"
      | "sideEffectType"
    >
): ToolManifest {
  return {
    id: partial.id,
    version: partial.version || "1.0.0",
    name: partial.name,
    description: partial.description || partial.name,
    category: partial.category,
    capabilities: partial.capabilities,
    inputSchema: partial.inputSchema || EMPTY_OBJECT_SCHEMA,
    outputSchema: partial.outputSchema || EMPTY_OBJECT_SCHEMA,
    requiredPermissions: partial.requiredPermissions || [],
    requiredFeatures: partial.requiredFeatures || [],
    requiredContext: partial.requiredContext || [],
    riskLevel: partial.riskLevel,
    sideEffectType: partial.sideEffectType,
    supportsObserve: partial.supportsObserve === true,
    supportsShadow: partial.supportsShadow === true,
    supportsActive: partial.supportsActive !== false,
    requiresOwnership: partial.requiresOwnership === true,
    requiresConfirmation: partial.requiresConfirmation || "never",
    idempotencyPolicy: {
      ...DEFAULT_TOOL_IDEMPOTENCY,
      ...(partial.idempotencyPolicy || {})
    },
    timeoutPolicy: {
      timeoutMs:
        partial.timeoutPolicy?.timeoutMs != null &&
        Number.isFinite(partial.timeoutPolicy.timeoutMs)
          ? Math.max(1, Number(partial.timeoutPolicy.timeoutMs))
          : 10000
    },
    retryPolicy: {
      ...DEFAULT_TOOL_RETRY_POLICY,
      ...(partial.retryPolicy || {})
    },
    rateLimitPolicy: {
      ...AUTOMATION_TOOL_TECHNICAL_RATE_LIMIT,
      ...(partial.rateLimitPolicy || {})
    },
    auditEnabled: partial.auditEnabled !== false,
    metricsEnabled: partial.metricsEnabled !== false,
    experimental: partial.experimental === true,
    deprecated: partial.deprecated === true,
    exposeToModel: partial.exposeToModel === true,
    owner: partial.owner || "atendechat.core",
    tags: Array.isArray(partial.tags) ? partial.tags : [],
    metadata: {
      runtimeVersion: AUTOMATION_TOOL_RUNTIME_VERSION,
      ...(partial.metadata || {})
    }
  };
}

export function makeToolResult(
  partial: Partial<ToolResult> & Pick<ToolResult, "status">
): ToolResult {
  return {
    status: partial.status,
    data: partial.data || {},
    displayData: partial.displayData || partial.data || {},
    metrics: partial.metrics || {
      durationMs: 0,
      attempts: 0,
      timedOut: false,
      retries: 0,
      rolledBack: false
    },
    logs: partial.logs || [],
    warnings: partial.warnings || [],
    errors: partial.errors || [],
    idempotencyKey: partial.idempotencyKey ?? null,
    executionId: partial.executionId ?? null,
    sideEffectCommitted: partial.sideEffectCommitted === true,
    rollbackAvailable: partial.rollbackAvailable === true,
    confirmationStatus: partial.confirmationStatus,
    audit: partial.audit,
    modelPayload: partial.modelPayload
  };
}

export function classifyToolError(
  err: unknown,
  fallback: ToolErrorType = "unexpected"
): ToolError {
  const message = err instanceof Error ? err.message : String(err);
  const safeMessage = message.slice(0, 500);

  if (message === "TOOL_TIMEOUT") {
    return {
      code: "TOOL_TIMEOUT",
      type: "timeout",
      message: "Tool execution timed out",
      retryable: true
    };
  }

  const prefixMap: Array<[string, ToolErrorType]> = [
    ["TOOL_VALIDATION:", "validation"],
    ["TOOL_PERMISSION:", "permission"],
    ["TOOL_FEATURE:", "feature"],
    ["TOOL_TENANT:", "tenant"],
    ["TOOL_OWNERSHIP:", "ownership"],
    ["TOOL_POLICY:", "policy"],
    ["TOOL_CONFIRMATION:", "confirmation"],
    ["TOOL_IDEMPOTENCY:", "idempotency"],
    ["TOOL_RATE_LIMIT:", "rate_limit"],
    ["TOOL_NOT_FOUND:", "not_found"],
    ["TOOL_CONFLICT:", "conflict"],
    ["TOOL_DEPENDENCY:", "dependency"],
    ["TOOL_CIRCUIT_OPEN:", "circuit_open"],
    ["TOOL_PROVIDER:", "provider"]
  ];

  for (const [prefix, type] of prefixMap) {
    if (message.startsWith(prefix)) {
      return {
        code: type.toUpperCase(),
        type,
        message: message.replace(prefix, "").trim() || safeMessage,
        retryable: type === "dependency" || type === "timeout"
      };
    }
  }

  return {
    code: fallback.toUpperCase(),
    type: fallback,
    message: safeMessage,
    retryable: false
  };
}

export type DefineToolHandlers = {
  execute: AutomationToolContract["execute"];
  supportsDiscovery?: AutomationToolContract["supportsDiscovery"];
  validateExecutionContext?: AutomationToolContract["validateExecutionContext"];
  prepare?: AutomationToolContract["prepare"];
  rollback?: AutomationToolContract["rollback"];
  cleanup?: AutomationToolContract["cleanup"];
  sanitizeInputForAudit?: AutomationToolContract["sanitizeInputForAudit"];
  sanitizeOutputForAudit?: AutomationToolContract["sanitizeOutputForAudit"];
};

export function defineTool(
  partial: Parameters<typeof buildToolManifest>[0],
  handlers: DefineToolHandlers
): AutomationToolContract {
  const manifest = buildToolManifest(partial);
  return {
    manifest: () => ({ ...manifest }),
    supportsDiscovery: handlers.supportsDiscovery || (() => true),
    validateExecutionContext: handlers.validateExecutionContext,
    prepare: handlers.prepare,
    execute: handlers.execute,
    rollback: handlers.rollback,
    cleanup: handlers.cleanup,
    sanitizeInputForAudit: handlers.sanitizeInputForAudit,
    sanitizeOutputForAudit: handlers.sanitizeOutputForAudit
  };
}
