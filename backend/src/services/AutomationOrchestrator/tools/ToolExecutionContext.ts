import {
  AutomationControlMode,
  AutomationOwnership
} from "../../../config/automationOrchestratorConstants";
import {
  ToolCapabilityKey,
  ToolInvocationSource
} from "../../../config/automationToolConstants";

/**
 * Contexto mínimo de execução de Tool.
 * Preferir IDs e snapshots — sem objetos Sequelize inteiros.
 */
export type ToolExecutionContext = {
  companyId: number;
  userId?: number | null;
  aiAgentId?: number | null;
  ticketId?: number | null;
  contactId?: number | null;
  whatsappId?: number | null;
  connectionId?: number | null;
  messageId?: string | null;
  channel?: string | null;
  automationExecutionId?: number | null;
  actionExecutionId?: number | string | null;
  controlMode: AutomationControlMode;
  executionOwner?: AutomationOwnership | string | null;
  capabilities: Partial<Record<ToolCapabilityKey, boolean>>;
  permissions: string[];
  featureFlags: Record<string, boolean>;
  requestId?: string | null;
  correlationId?: string | null;
  source: ToolInvocationSource;
  /** Allowlist de Tools expostas nesta execução (id@version). */
  allowedToolKeys?: string[];
  /** Modo explícito de teste admin. */
  adminTestMode?: boolean;
  metadata?: Record<string, unknown>;
};

export function buildToolExecutionContext(
  partial: Partial<ToolExecutionContext> &
    Pick<ToolExecutionContext, "companyId" | "controlMode" | "source">
): ToolExecutionContext {
  return {
    companyId: partial.companyId,
    userId: partial.userId ?? null,
    aiAgentId: partial.aiAgentId ?? null,
    ticketId: partial.ticketId ?? null,
    contactId: partial.contactId ?? null,
    whatsappId: partial.whatsappId ?? null,
    connectionId: partial.connectionId ?? null,
    messageId: partial.messageId ?? null,
    channel: partial.channel ?? null,
    automationExecutionId: partial.automationExecutionId ?? null,
    actionExecutionId: partial.actionExecutionId ?? null,
    controlMode: partial.controlMode,
    executionOwner: partial.executionOwner ?? "legacy",
    capabilities: partial.capabilities || {},
    permissions: Array.isArray(partial.permissions) ? partial.permissions : [],
    featureFlags: partial.featureFlags || {},
    requestId: partial.requestId ?? null,
    correlationId: partial.correlationId ?? null,
    source: partial.source,
    allowedToolKeys: partial.allowedToolKeys,
    adminTestMode: partial.adminTestMode === true,
    metadata: partial.metadata || {}
  };
}

/** Resumo sanitizado para system.context_summary — sem secrets. */
export function sanitizeContextSummary(
  ctx: ToolExecutionContext
): Record<string, unknown> {
  return {
    companyId: ctx.companyId,
    userId: ctx.userId ?? null,
    aiAgentId: ctx.aiAgentId ?? null,
    ticketId: ctx.ticketId ?? null,
    contactId: ctx.contactId ?? null,
    whatsappId: ctx.whatsappId ?? null,
    messageId: ctx.messageId ? String(ctx.messageId).slice(0, 64) : null,
    channel: ctx.channel ?? null,
    automationExecutionId: ctx.automationExecutionId ?? null,
    actionExecutionId: ctx.actionExecutionId ?? null,
    controlMode: ctx.controlMode,
    executionOwner: ctx.executionOwner ?? null,
    source: ctx.source,
    capabilityCount: Object.keys(ctx.capabilities || {}).length,
    permissionCount: (ctx.permissions || []).length,
    featureFlagKeys: Object.keys(ctx.featureFlags || {}).slice(0, 50),
    hasAllowlist: Array.isArray(ctx.allowedToolKeys),
    allowlistSize: Array.isArray(ctx.allowedToolKeys)
      ? ctx.allowedToolKeys.length
      : 0,
    adminTestMode: ctx.adminTestMode === true,
    requestId: ctx.requestId ?? null,
    correlationId: ctx.correlationId ?? null
  };
}
