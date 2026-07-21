import { createHash } from "crypto";
import {
  providerFunctionNameToToolId
} from "../../../../config/automationFunctionCallingConstants";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../../../../config/automationOrchestratorConstants";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../../../../config/automationToolConstants";
import { getTool, getToolVersion } from "../ToolRegistry";
import { resolveToolFromAllowlist, assertToolInAllowlist } from "../ToolAllowlist";
import { validateToolSchema } from "../schemaValidation";
import { runToolViaRuntime } from "../AutomationToolRuntime";
import { buildToolExecutionContext, ToolExecutionContext } from "../ToolExecutionContext";
import { toModelResult } from "../ToolModelResultAdapter";
import { emitToolEvent } from "../ToolEventBus";
import { recordFunctionCallingMetric } from "./FunctionCallingMetrics";

export type ProviderToolCall = {
  id: string;
  name: string;
  arguments: string | Record<string, unknown>;
};

export type ResolvedToolCall = {
  callId: string;
  toolId: string;
  toolVersion: string;
  status: "success" | "denied" | "invalid" | "failure";
  arguments: Record<string, unknown>;
  /** Sempre ToolModelResult — nunca internal. */
  modelResult: Record<string, unknown>;
  error?: string;
  durationMs: number;
};

function parseArguments(
  raw: string | Record<string, unknown>
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ok: true, value: raw as Record<string, unknown> };
  }
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "arguments_not_object" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "arguments_invalid_json" };
  }
}

export function hashToolCall(
  toolId: string,
  args: Record<string, unknown>
): string {
  return createHash("sha256")
    .update(`${toolId}:${JSON.stringify(args)}`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Function Call Resolver — valida e executa via Tool Runtime.
 * Nunca executa Tool diretamente.
 */
export async function resolveProviderToolCall(input: {
  call: ProviderToolCall;
  ctx: ToolExecutionContext;
  allowlist: Array<{ id: string; version: string; key: string }>;
  companyPolicy?: Record<string, unknown> | null;
  persist?: boolean;
}): Promise<ResolvedToolCall> {
  const started = Date.now();
  const callId = String(input.call.id || `call-${Date.now()}`);
  const requestedId = providerFunctionNameToToolId(input.call.name);

  const deny = (
    status: ResolvedToolCall["status"],
    error: string,
    toolId = requestedId,
    toolVersion = "unknown"
  ): ResolvedToolCall => {
    void emitToolEvent({
      companyId: input.ctx.companyId,
      eventName:
        status === "invalid" ? "ToolCallInvalid" : "ToolCallDenied",
      toolId,
      payload: { callId, error, status }
    });
    recordFunctionCallingMetric({
      companyId: input.ctx.companyId,
      kind: status === "invalid" ? "invalidCall" : "toolDenial",
      toolId
    });
    return {
      callId,
      toolId,
      toolVersion,
      status,
      arguments: {},
      modelResult: {
        status: status === "denied" ? "denied" : "failure",
        summary: error,
        tool: toolId
      },
      error,
      durationMs: Date.now() - started
    };
  };

  const resolved = resolveToolFromAllowlist({
    requestedId,
    allowlist: input.allowlist
  });
  if (!resolved) {
    return deny("denied", "tool_not_in_allowlist");
  }

  try {
    assertToolInAllowlist({
      toolId: resolved.id,
      toolVersion: resolved.version,
      allowedToolKeys: input.ctx.allowedToolKeys || input.allowlist.map(a => a.key)
    });
  } catch (err) {
    return deny(
      "denied",
      err instanceof Error ? err.message : "allowlist_assert_failed",
      resolved.id,
      resolved.version
    );
  }

  const tool =
    getToolVersion(resolved.id, resolved.version) || getTool(resolved.id);
  if (!tool) {
    return deny("invalid", "tool_not_found", resolved.id, resolved.version);
  }
  const manifest = tool.manifest();
  if (!manifest.inputSchema || !manifest.outputSchema) {
    return deny("invalid", "tool_missing_schema", resolved.id, resolved.version);
  }
  if (manifest.exposeToModel !== true) {
    return deny("denied", "tool_not_exposed", resolved.id, resolved.version);
  }
  // Shadow / FC: nunca Write Tools nem Operation Runtime
  if (
    manifest.sideEffectType === "database_write" ||
    (manifest.metadata as any)?.operationRuntime === true
  ) {
    return deny(
      "denied",
      "write_or_operation_blocked",
      resolved.id,
      resolved.version
    );
  }

  const argsParsed = parseArguments(input.call.arguments);
  if (argsParsed.ok === false) {
    return deny(
      "invalid",
      argsParsed.error,
      resolved.id,
      resolved.version
    );
  }

  const schemaErrors = validateToolSchema(
    manifest.inputSchema,
    argsParsed.value,
    "input"
  );
  if (schemaErrors.length) {
    return deny(
      "invalid",
      `schema_invalid:${schemaErrors.join(",")}`,
      resolved.id,
      resolved.version
    );
  }

  await emitToolEvent({
    companyId: input.ctx.companyId,
    eventName: "ToolCallRequested",
    toolId: resolved.id,
    toolVersion: resolved.version,
    payload: { callId }
  });

  const result = await runToolViaRuntime({
    toolId: resolved.id,
    toolVersion: resolved.version,
    tool,
    ctx: {
      ...input.ctx,
      allowedToolKeys:
        input.ctx.allowedToolKeys || input.allowlist.map(a => a.key)
    },
    input: argsParsed.value,
    companyPolicy: {
      enabled: true,
      maxRiskLevel: "read_only",
      allowWrite: false,
      ...(input.companyPolicy || {})
    } as any,
    persist: input.persist !== false
  });

  const modelResult = (result.modelResult ||
    toModelResult(result, resolved.id)) as Record<string, unknown>;

  // Sanidade: nunca vazar campos internos
  const safeModel = {
    status: modelResult.status,
    summary: modelResult.summary,
    tool: modelResult.tool || resolved.id,
    data: modelResult.data,
    warnings: modelResult.warnings
  };

  await emitToolEvent({
    companyId: input.ctx.companyId,
    eventName: "ToolCallResolved",
    toolId: resolved.id,
    toolVersion: resolved.version,
    payload: { callId, status: result.status }
  });

  recordFunctionCallingMetric({
    companyId: input.ctx.companyId,
    kind: "toolCall",
    toolId: resolved.id,
    durationMs: Date.now() - started,
    status: result.status
  });

  return {
    callId,
    toolId: resolved.id,
    toolVersion: resolved.version,
    status:
      result.status === "success"
        ? "success"
        : result.status === "denied" || result.status === "skipped"
          ? "denied"
          : "failure",
    arguments: argsParsed.value,
    modelResult: safeModel,
    durationMs: Date.now() - started
  };
}

export function buildSimulatorToolContext(input: {
  companyId: number;
  userId?: number | null;
  aiAgentId?: number | null;
  allowedToolKeys: string[];
  featureFlags?: Record<string, boolean>;
  requestId?: string;
}): ToolExecutionContext {
  return buildFunctionCallingToolContext({
    ...input,
    source: "simulator",
    channel: "simulator"
  });
}

/** Contexto FC — simulator, shadow (observacional) ou live (produção controlada). */
export function buildFunctionCallingToolContext(input: {
  companyId: number;
  userId?: number | null;
  aiAgentId?: number | null;
  ticketId?: number | null;
  contactId?: number | null;
  allowedToolKeys: string[];
  featureFlags?: Record<string, boolean>;
  requestId?: string;
  source: "simulator" | "shadow" | "admin_test" | "live";
  channel?: string;
}): ToolExecutionContext {
  const source = input.source;
  return buildToolExecutionContext({
    companyId: input.companyId,
    userId: input.userId ?? null,
    aiAgentId: input.aiAgentId ?? null,
    ticketId: input.ticketId ?? null,
    contactId: input.contactId ?? null,
    controlMode: source === "shadow" ? "shadow_execute" : "active",
    source:
      source === "admin_test"
        ? "admin_test"
        : source === "live"
          ? "live"
          : source,
    adminTestMode: source === "admin_test",
    executionOwner: "orchestrator",
    channel: input.channel || source,
    allowedToolKeys: input.allowedToolKeys,
    capabilities: {
      "tool.read": true,
      "contact.read": true,
      "ticket.read": true,
      "queue.read": true,
      "user.read": true
    },
    permissions: [
      "aiTools.view",
      "aiTools.test",
      "aiTools.executeRead"
    ],
    featureFlags: {
      [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
      [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true,
      "automation.knowledge_base": true,
      ...(input.featureFlags || {})
    },
    requestId: input.requestId || `fc-${source}-${Date.now()}`,
    correlationId: `fc-${source}-${input.companyId}`,
    metadata: {
      functionCalling: true,
      channel: input.channel || source,
      observational: source === "shadow",
      live: source === "live"
    }
  });
}

export default { resolveProviderToolCall, hashToolCall };
