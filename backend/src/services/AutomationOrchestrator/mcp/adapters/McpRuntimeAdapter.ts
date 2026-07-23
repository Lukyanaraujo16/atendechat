import { createHash } from "crypto";
import { RuntimeType } from "../../../../config/automationRuntimeIntegrationConstants";
import { RuntimeAdapter, RuntimeAdapterExecuteInput } from "../../runtimeIntegration/RuntimeAdapter";
import { RuntimeAdapterResult, RuntimeCapability } from "../../runtimeIntegration/types";
import { defaultMcpClientManager } from "../McpClientManager";
import { evaluateMcpToolPolicy } from "../McpToolPolicyEngine";
import { normalizeMcpResult } from "../McpResultNormalizer";
import {
  buildMcpIdempotencyKey,
  claimMcpIdempotency,
  completeMcpIdempotency
} from "../McpIdempotency";
import { evaluateRetrySafety } from "../McpSafetyEvaluators";
import { emitMcpEvent } from "../McpEvents";
import {
  recordMcpAudit,
  recordMcpExecution,
  recordMcpMetric
} from "../McpMetrics";
import { getMcpConfig } from "../McpConfig";

/**
 * McpRuntimeAdapter — RuntimeAdapter para MCP.
 * Não vaza objetos do SDK para o Core Cognitivo.
 */
export class McpRuntimeAdapter implements RuntimeAdapter {
  readonly name = "McpRuntimeAdapter";
  readonly runtimeType: RuntimeType = "MCP";

  supports(capability: RuntimeCapability): boolean {
    return (
      capability.runtimeType === "MCP" ||
      capability.requiredAdapter === "McpRuntimeAdapter"
    );
  }

  async execute(
    input: RuntimeAdapterExecuteInput
  ): Promise<RuntimeAdapterResult> {
    const start = Date.now();
    const serverId = String(
      input.capability.metadata?.serverId ||
        input.request.metadata?.mcpServerId ||
        ""
    );
    const toolName = String(
      input.capability.toolId ||
        input.capability.metadata?.toolName ||
        input.request.operation ||
        ""
    );

    if (!serverId || !toolName) {
      return fail(start, input, "ERR_MCP_TOOL_NOT_FOUND", [
        "serverId_or_tool_missing"
      ]);
    }

    const mode = String(input.request.metadata?.mcpMode || "execute") as
      | "preview"
      | "dry_run"
      | "execute"
      | "confirm";
    const confirmed = Boolean(
      input.request.confirmationPolicy.confirmed ||
        input.request.metadata?.confirmed
    );

    const policy = evaluateMcpToolPolicy({
      companyId: input.companyId,
      serverId,
      toolName,
      args: input.request.parameters,
      confirmed,
      mode,
      planEnabled: input.request.metadata?.mcpPlanEnabled !== false,
      permissionGranted: input.request.metadata?.mcpPermissionGranted !== false
    });

    recordMcpMetric("request", { serverId, toolName });

    if (policy.executionMode === "BLOCKED") {
      recordMcpMetric("policyDenial", {
        serverId,
        toolName,
        errorCode: policy.violations[0]
      });
      return fail(
        start,
        input,
        policy.violations[0] || "ERR_MCP_POLICY_DENIED",
        policy.violations,
        policy.warnings,
        {
          policy,
          serverId,
          toolName
        }
      );
    }

    if (policy.executionMode === "CONFIRMATION_REQUIRED") {
      recordMcpMetric("confirmation", { serverId, toolName });
      emitMcpEvent(input.companyId, "MCP_CONFIRMATION_REQUIRED", toolName);
      return {
        status: "waiting",
        runtimeType: "MCP",
        adapter: this.name,
        capability: input.capability.kind,
        toolId: toolName,
        modelResult: {
          awaitingConfirmation: true,
          policy
        },
        errors: ["ERR_MCP_TOOL_CONFIRMATION_REQUIRED"],
        warnings: policy.warnings,
        durationMs: Date.now() - start,
        metadata: {
          serverId,
          toolName,
          policy,
          runtimeType: "MCP",
          liveIntegration: false
        }
      };
    }

    if (
      policy.executionMode === "PREVIEW" ||
      policy.executionMode === "DRY_RUN"
    ) {
      return {
        status: "success",
        runtimeType: "MCP",
        adapter: this.name,
        capability: input.capability.kind,
        toolId: toolName,
        modelResult: {
          preview: true,
          dryRun: policy.executionMode === "DRY_RUN",
          wouldCall: { serverId, toolName },
          arguments: policy.sanitizedArguments
        },
        errors: [],
        warnings: policy.warnings,
        durationMs: Date.now() - start,
        metadata: {
          serverId,
          toolName,
          policy,
          runtimeType: "MCP",
          executed: false
        }
      };
    }

    const idemKey = buildMcpIdempotencyKey({
      companyId: input.companyId,
      executionId: input.request.executionId,
      actionId: input.request.actionId,
      requestId: input.request.requestId,
      serverId,
      toolName
    });
    const claim = claimMcpIdempotency(idemKey);
    if (!claim.ok) {
      return fail(start, input, "ERR_MCP_POLICY_DENIED", [
        "idempotency_duplicate"
      ], [], { serverId, toolName, idemKey });
    }

    emitMcpEvent(input.companyId, "MCP_EXECUTION_STARTED", toolName, {
      serverId
    });

    const cfg = getMcpConfig(input.companyId);
    let attempt = 0;
    let lastError = "ERR_MCP_PROTOCOL";
    let executionStarted = false;

    while (attempt <= cfg.maxRetries) {
      attempt += 1;
      try {
        const client = await defaultMcpClientManager.connect({
          companyId: input.companyId,
          serverId
        });
        executionStarted = true;

        const raw = await Promise.race([
          client.callTool({
            name: toolName,
            arguments: {
              ...policy.sanitizedArguments,
              ...(input.request.metadata?.forwardIdempotency
                ? { idempotencyKey: idemKey }
                : {})
            }
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("ERR_MCP_EXECUTION_TIMEOUT")),
              policy.effectiveTimeout
            )
          )
        ]);

        defaultMcpClientManager.releaseExecution(input.companyId, serverId);
        const normalized = normalizeMcpResult(raw as any);
        const durationMs = Date.now() - start;

        if (normalized.isError) {
          completeMcpIdempotency(idemKey, "failure");
          recordMcpMetric("failure", {
            serverId,
            toolName,
            errorCode: "ERR_MCP_PROTOCOL",
            latencyMs: durationMs
          });
          emitMcpEvent(input.companyId, "MCP_EXECUTION_FAILED", toolName);
          return fail(
            start,
            input,
            "ERR_MCP_PROTOCOL",
            [normalized.error || "mcp_error"],
            normalized.warnings,
            { serverId, toolName, normalized, policy }
          );
        }

        completeMcpIdempotency(idemKey, "success");
        recordMcpMetric("success", {
          serverId,
          toolName,
          latencyMs: durationMs
        });
        emitMcpEvent(input.companyId, "MCP_EXECUTION_COMPLETED", toolName);

        const execId = `mcpex_${createHash("sha256")
          .update(`${input.request.requestId}:${toolName}`)
          .digest("hex")
          .slice(0, 12)}`;

        recordMcpExecution({
          id: execId,
          companyId: input.companyId,
          serverId,
          toolName,
          dispatch: (input.request.metadata?.dispatchDecision as any) || {
            requestId: input.request.requestId,
            capability: input.capability.kind,
            selectedRuntimeType: "MCP",
            selectedAdapter: this.name,
            selectedServerId: serverId,
            selectedTool: toolName,
            reasonCodes: ["mcp_adapter"],
            fallbackRuntimeType: "TOOL_RUNTIME",
            fallbackAvailable: true,
            confidence: 0.8,
            createdAt: new Date().toISOString(),
            metadata: {}
          },
          policy,
          result: normalized,
          status: "success",
          durationMs,
          createdAt: new Date().toISOString(),
          metadata: { idemKey }
        });

        recordMcpAudit({
          companyId: input.companyId,
          userId: input.userId ?? null,
          agentId: null,
          sessionId: String(input.request.metadata?.sessionId || null),
          actionId: input.request.actionId,
          runtimeRequestId: input.request.requestId,
          serverId,
          toolName,
          runtimeType: "MCP",
          operationClassification: policy.classification,
          policyDecision: policy.executionMode,
          argumentsSanitized: policy.sanitizedArguments,
          startedAt: new Date(start).toISOString(),
          finishedAt: new Date().toISOString(),
          status: "success",
          errorCode: null,
          resultSummary: normalized.content || JSON.stringify(normalized.structuredData || {})
        });

        return {
          status: "success",
          runtimeType: "MCP",
          adapter: this.name,
          capability: input.capability.kind,
          toolId: toolName,
          modelResult: {
            content: normalized.content,
            structuredData: normalized.structuredData,
            resources: normalized.resources
          },
          internalData: { normalized },
          errors: [],
          warnings: [...policy.warnings, ...normalized.warnings],
          durationMs,
          metadata: {
            serverId,
            toolName,
            policy,
            idemKey,
            runtimeType: "MCP",
            reusedExistingRuntime: false,
            usesMcpSdk: true,
            liveIntegration: false,
            executionId: execId
          }
        };
      } catch (err) {
        lastError =
          err instanceof Error ? err.message : "ERR_MCP_PROTOCOL";
        defaultMcpClientManager.releaseExecution(input.companyId, serverId);
        const retry = evaluateRetrySafety({
          errorCode: lastError.startsWith("ERR_MCP_")
            ? lastError
            : "ERR_MCP_PROTOCOL",
          classification: policy.classification,
          executionConfirmedStarted: executionStarted
        });
        if (retry === "UNSAFE" || attempt > cfg.maxRetries) break;
      }
    }

    completeMcpIdempotency(idemKey, "failure");
    const code = lastError.startsWith("ERR_MCP_")
      ? lastError
      : "ERR_MCP_PROTOCOL";
    if (code === "ERR_MCP_EXECUTION_TIMEOUT") {
      recordMcpMetric("timeout", { serverId, toolName, errorCode: code });
    } else {
      recordMcpMetric("failure", { serverId, toolName, errorCode: code });
    }
    emitMcpEvent(input.companyId, "MCP_EXECUTION_FAILED", toolName, code);
    return fail(start, input, code, [code], policy.warnings, {
      serverId,
      toolName,
      policy
    });
  }
}

function fail(
  start: number,
  input: RuntimeAdapterExecuteInput,
  code: string,
  errors: string[],
  warnings: string[] = [],
  meta: Record<string, unknown> = {}
): RuntimeAdapterResult {
  return {
    status: code.includes("TIMEOUT") ? "timeout" : "failure",
    runtimeType: "MCP",
    adapter: "McpRuntimeAdapter",
    capability: input.capability.kind,
    toolId: String(meta.toolName || ""),
    modelResult: { errorCode: code },
    errors,
    warnings,
    durationMs: Date.now() - start,
    metadata: {
      ...meta,
      errorCode: code,
      runtimeType: "MCP",
      liveIntegration: false
    }
  };
}

export default new McpRuntimeAdapter();
