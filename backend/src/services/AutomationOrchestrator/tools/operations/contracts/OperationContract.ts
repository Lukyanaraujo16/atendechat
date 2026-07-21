import {
  CONTACT_ALLOWED_UPDATE_FIELDS,
  OperationErrorType,
  OperationResourceType,
  OperationRiskLevel,
  OperationSideEffectType,
  OperationStatus,
  AUTOMATION_OPERATION_RUNTIME_VERSION
} from "../../../../../config/automationOperationConstants";
import { ToolExecutionContext } from "../../ToolExecutionContext";
import { Transaction } from "sequelize";

export type OperationRetryPolicy = {
  retryable: boolean;
  maxRetries: number;
  backoffMs: number;
};

export type OperationTimeoutPolicy = {
  timeoutMs: number;
};

export type OperationManifest = {
  id: string;
  version: string;
  name: string;
  description: string;
  risk: OperationRiskLevel;
  sideEffect: OperationSideEffectType;
  supportsPreview: boolean;
  supportsDryRun: boolean;
  supportsRollback: boolean;
  transactionRequired: boolean;
  requiresConfirmation: boolean;
  requiredPermissions: string[];
  requiredFeatures: string[];
  resourceTypes: OperationResourceType[];
  timeoutPolicy: OperationTimeoutPolicy;
  retryPolicy: OperationRetryPolicy;
  owner: string;
  tags: string[];
  metadata?: Record<string, unknown>;
};

export type OperationContext = {
  toolCtx: ToolExecutionContext;
  dryRun: boolean;
  previewOnly: boolean;
  confirmed: boolean;
  requestId: string;
  correlationId?: string | null;
  transactionId?: string | null;
  metadata?: Record<string, unknown>;
};

export type OperationSnapshot = {
  resourceType: OperationResourceType;
  resourceId: string | number;
  fields: Record<string, unknown>;
  capturedAt: string;
};

export type OperationPreview = {
  operationId: string;
  summary: string;
  current: Record<string, unknown>;
  proposed: Record<string, unknown>;
  validations: string[];
  warnings: string[];
  affectedResources: Array<{
    type: OperationResourceType;
    id: string | number;
    label?: string;
  }>;
  blockers: string[];
  dryRunCapable: boolean;
};

export type OperationError = {
  code: string;
  type: OperationErrorType;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export type OperationAudit = {
  operationId: string;
  operationVersion: string;
  companyId: number;
  requestedBy?: number | null;
  source: string;
  dryRun: boolean;
  previewOnly: boolean;
  confirmed: boolean;
  transactionId: string | null;
  durationMs: number;
  status: OperationStatus;
  policyDecision?: string;
};

export type OperationTransaction = {
  id: string;
  opened: boolean;
  committed: boolean;
  rolledBack: boolean;
};

export type OperationRollback = {
  requested: boolean;
  supported: boolean;
  succeeded: boolean;
  message?: string;
};

export type OperationChangedField = {
  field: string;
  before: unknown;
  after: unknown;
};

export interface AutomationOperationContract {
  manifest(): OperationManifest;
  validate?(
    ctx: OperationContext,
    input: Record<string, unknown>
  ): void | Promise<void>;
  preview(
    ctx: OperationContext,
    input: Record<string, unknown>
  ): Promise<OperationPreview>;
  captureBefore(
    ctx: OperationContext,
    input: Record<string, unknown>
  ): Promise<OperationSnapshot[]>;
  execute(
    ctx: OperationContext,
    input: Record<string, unknown>,
    transaction: Transaction | null
  ): Promise<{
    data: Record<string, unknown>;
    afterSnapshots: OperationSnapshot[];
  }>;
  rollback?(
    ctx: OperationContext,
    input: Record<string, unknown>,
    before: OperationSnapshot[]
  ): Promise<void>;
  detectConflict?(
    ctx: OperationContext,
    input: Record<string, unknown>,
    before: OperationSnapshot[]
  ): Promise<OperationError | null>;
}

export function buildOperationManifest(
  partial: Partial<OperationManifest> &
    Pick<
      OperationManifest,
      "id" | "name" | "description" | "risk" | "sideEffect" | "resourceTypes"
    >
): OperationManifest {
  return {
    id: partial.id,
    version: partial.version || "1.0.0",
    name: partial.name,
    description: partial.description,
    risk: partial.risk,
    sideEffect: partial.sideEffect,
    supportsPreview: partial.supportsPreview !== false,
    supportsDryRun: partial.supportsDryRun !== false,
    supportsRollback: partial.supportsRollback === true,
    transactionRequired: partial.transactionRequired !== false,
    requiresConfirmation: partial.requiresConfirmation === true,
    requiredPermissions: partial.requiredPermissions || [
      "aiTools.executeWrite"
    ],
    requiredFeatures: partial.requiredFeatures || [],
    resourceTypes: partial.resourceTypes,
    timeoutPolicy: {
      timeoutMs: partial.timeoutPolicy?.timeoutMs || 15000
    },
    retryPolicy: {
      retryable: false,
      maxRetries: 0,
      backoffMs: 0,
      ...(partial.retryPolicy || {})
    },
    owner: partial.owner || "atendechat.operations",
    tags: Array.isArray(partial.tags) ? partial.tags : ["write", "2.1c"],
    metadata: {
      runtimeVersion: AUTOMATION_OPERATION_RUNTIME_VERSION,
      allowedContactFields: [...CONTACT_ALLOWED_UPDATE_FIELDS],
      ...(partial.metadata || {})
    }
  };
}

export function defineOperation(
  partial: Parameters<typeof buildOperationManifest>[0],
  handlers: Omit<AutomationOperationContract, "manifest">
): AutomationOperationContract {
  const manifest = buildOperationManifest(partial);
  return {
    manifest: () => ({ ...manifest }),
    ...handlers
  };
}

export function classifyOperationError(
  err: unknown,
  fallback: OperationErrorType = "unexpected"
): OperationError {
  const message = err instanceof Error ? err.message : String(err);
  const safe = message.slice(0, 500);

  const map: Array<[string, OperationErrorType]> = [
    ["OPERATION_VALIDATION:", "validation"],
    ["OPERATION_PERMISSION:", "permission"],
    ["OPERATION_FEATURE:", "feature"],
    ["OPERATION_TENANT:", "tenant"],
    ["OPERATION_CONFIRMATION:", "confirmation"],
    ["OPERATION_IDEMPOTENCY:", "idempotency"],
    ["OPERATION_CONFLICT:", "conflict"],
    ["OPERATION_LOCK:", "lock"],
    ["OPERATION_NOT_FOUND:", "not_found"],
    ["TOOL_TIMEOUT", "timeout"],
    ["OPERATION_TIMEOUT", "timeout"]
  ];

  for (const [prefix, type] of map) {
    if (message === prefix || message.startsWith(prefix)) {
      return {
        code: type.toUpperCase(),
        type,
        message: message.replace(prefix, "").trim() || safe,
        retryable: type === "timeout" || type === "lock"
      };
    }
  }

  if (message.includes("outra empresa") || message.includes("ERR_NO_PERMISSION")) {
    return {
      code: "TENANT",
      type: "tenant",
      message: safe,
      retryable: false
    };
  }

  return {
    code: fallback.toUpperCase(),
    type: fallback,
    message: safe,
    retryable: false
  };
}
