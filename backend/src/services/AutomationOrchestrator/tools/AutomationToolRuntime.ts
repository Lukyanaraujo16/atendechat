import { randomUUID } from "crypto";
import {
  AUTOMATION_TOOL_SNAPSHOT_MAX_BYTES,
  isWriteSideEffect
} from "../../../config/automationToolConstants";
import {
  AutomationToolContract,
  ToolManifest,
  ToolResult,
  classifyToolError,
  makeToolResult
} from "./contracts/ToolContract";
import { ToolExecutionContext } from "./ToolExecutionContext";
import {
  getTool,
  getToolVersion,
  validateToolManifest
} from "./ToolRegistry";
import { evaluateToolPolicy } from "./AutomationToolPolicyEngine";
import { validateToolSchema } from "./schemaValidation";
import {
  acquireToolLock,
  buildToolIdempotencyKey,
  releaseToolLock
} from "./ToolIdempotency";
import {
  isToolCircuitOpen,
  recordToolFailure,
  recordToolSuccess
} from "./ToolCircuitBreaker";
import { checkToolRateLimit } from "./ToolRateLimit";
import { recordToolMetric } from "./ToolMetrics";
import { emitToolEvent } from "./ToolEventBus";
import { sanitizeToolSnapshot } from "./sanitizeToolSnapshot";
import { assertToolInAllowlist } from "./ToolAllowlist";
import { persistToolExecution } from "./persistToolExecution";
import {
  toModelResult,
  diffInternalVsModel
} from "./ToolModelResultAdapter";

export type CompanyToolPolicy = {
  enabled?: boolean;
  maxRiskLevel?: import("../../../config/automationToolConstants").ToolRiskLevel;
  allowWrite?: boolean;
  requireConfirmationFor?: import("../../../config/automationToolConstants").ToolRiskLevel[];
  deniedToolIds?: string[];
  allowedToolIds?: string[] | null;
};

export type RunToolViaRuntimeInput = {
  toolId: string;
  toolVersion?: string;
  ctx: ToolExecutionContext;
  input?: Record<string, unknown>;
  companyPolicy?: CompanyToolPolicy | null;
  /** Forçar Tool já resolvida (testes). */
  tool?: AutomationToolContract;
  persist?: boolean;
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("TOOL_TIMEOUT")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function resolveTool(
  toolId: string,
  toolVersion: string | undefined,
  injected?: AutomationToolContract
): { tool: AutomationToolContract; manifest: ToolManifest } {
  if (injected) {
    return { tool: injected, manifest: injected.manifest() };
  }
  const tool = toolVersion
    ? getToolVersion(toolId, toolVersion)
    : getTool(toolId);
  if (!tool) {
    throw new Error(`TOOL_NOT_FOUND: ${toolId}${toolVersion ? `@${toolVersion}` : ""}`);
  }
  return { tool, manifest: tool.manifest() };
}

function sanitizeViaTool(
  tool: AutomationToolContract,
  kind: "input" | "output",
  data: Record<string, unknown>
): Record<string, unknown> {
  if (kind === "input" && typeof tool.sanitizeInputForAudit === "function") {
    return sanitizeToolSnapshot(tool.sanitizeInputForAudit(data));
  }
  if (kind === "output" && typeof tool.sanitizeOutputForAudit === "function") {
    return sanitizeToolSnapshot(tool.sanitizeOutputForAudit(data));
  }
  return sanitizeToolSnapshot(data);
}

/**
 * Runtime universal de Tools.
 * Nenhuma Tool pode ser executada fora deste caminho.
 */
export async function runToolViaRuntime(
  input: RunToolViaRuntimeInput
): Promise<ToolResult> {
  const started = Date.now();
  const executionId = randomUUID();
  const logs: string[] = [];
  const warnings: string[] = [];
  let lockKey: string | null = null;
  let attempts = 0;
  let timedOut = false;
  let rolledBack = false;
  let sideEffectCommitted = false;
  let rollbackStatus: string = "none";
  let idempotencyKey: string | null = null;
  let manifest: ToolManifest | null = null;
  let policyReason = "n/a";
  let permissionDecision = "n/a";
  let featureDecision = "n/a";

  const finish = async (
    result: ToolResult,
    extras?: {
      errorSnapshot?: Record<string, unknown>;
      confirmationStatus?: string;
    }
  ): Promise<ToolResult> => {
    const durationMs = Date.now() - started;
    const readMeta =
      result.data && typeof result.data === "object"
        ? ((result.data as { __readMeta?: Record<string, unknown> })
            .__readMeta as
            | {
                resultCount?: number;
                emptyResult?: boolean;
                cacheHit?: boolean;
              }
            | undefined)
        : undefined;

    const metrics = {
      ...result.metrics,
      durationMs,
      resultCount:
        result.metrics.resultCount ??
        (typeof readMeta?.resultCount === "number"
          ? readMeta.resultCount
          : undefined),
      emptyResult:
        result.metrics.emptyResult ??
        (readMeta?.emptyResult === true ? true : undefined),
      cacheHit:
        result.metrics.cacheHit ??
        (readMeta?.cacheHit === true ? true : undefined),
      cacheMiss:
        result.metrics.cacheMiss ??
        (readMeta?.cacheHit === false ? true : undefined)
    };

    // Strip internal meta from persisted/display data
    const cleanData = { ...(result.data || {}) };
    delete (cleanData as { __readMeta?: unknown }).__readMeta;
    const cleanDisplay = { ...(result.displayData || cleanData) };
    delete (cleanDisplay as { __readMeta?: unknown }).__readMeta;

    const toolId = manifest?.id || input.toolId;
    const withClean: ToolResult = {
      ...result,
      data: cleanData,
      displayData: cleanDisplay,
      metrics,
      executionId: result.executionId || executionId,
      idempotencyKey: result.idempotencyKey ?? idempotencyKey,
      audit: {
        requestedBy: input.ctx.userId ?? input.ctx.aiAgentId ?? null,
        source: input.ctx.source,
        companyId: input.ctx.companyId,
        toolId,
        toolVersion: manifest?.version || input.toolVersion || "unknown",
        controlMode: input.ctx.controlMode,
        ownership: input.ctx.executionOwner ?? null,
        policyDecision: policyReason,
        permissionDecision,
        featureDecision,
        attemptCount: attempts,
        durationMs,
        correlationId: input.ctx.correlationId ?? null,
        sideEffectCommitted,
        rollbackStatus
      }
    };

    // Runtime attaches modelResult — Tools não podem bypassar o adapter.
    const modelResult = toModelResult(withClean, toolId);
    const final: ToolResult = {
      ...withClean,
      modelResult: modelResult as unknown as Record<string, unknown>
    };

    if (manifest?.metricsEnabled !== false) {
      recordToolMetric({
        companyId: input.ctx.companyId,
        toolId,
        toolVersion: manifest?.version || "unknown",
        source: input.ctx.source,
        riskLevel: manifest?.riskLevel || "read_only",
        sideEffectType: manifest?.sideEffectType || "none",
        status: final.status,
        durationMs,
        retries: final.metrics.retries,
        timedOut: final.metrics.timedOut,
        rolledBack: final.metrics.rolledBack,
        confirmation: final.status === "waiting_confirmation",
        resultCount: final.metrics.resultCount,
        emptyResult: final.metrics.emptyResult,
        cacheHit: final.metrics.cacheHit,
        cacheMiss: final.metrics.cacheMiss
      });
    }

    if (input.persist !== false && manifest) {
      await persistToolExecution({
        companyId: input.ctx.companyId,
        toolId: manifest.id,
        toolVersion: manifest.version,
        category: manifest.category,
        source: input.ctx.source,
        riskLevel: manifest.riskLevel,
        sideEffectType: manifest.sideEffectType,
        status: final.status,
        controlMode: input.ctx.controlMode,
        executionOwner: String(input.ctx.executionOwner || "legacy"),
        automationExecutionId: input.ctx.automationExecutionId ?? null,
        actionExecutionId: input.ctx.actionExecutionId
          ? String(input.ctx.actionExecutionId)
          : null,
        ticketId: input.ctx.ticketId ?? null,
        contactId: input.ctx.contactId ?? null,
        messageId: input.ctx.messageId ?? null,
        requestId: input.ctx.requestId ?? null,
        correlationId: input.ctx.correlationId ?? null,
        idempotencyKey,
        inputSnapshot: sanitizeViaTool(
          input.tool || getTool(manifest.id) || ({
            sanitizeInputForAudit: undefined,
            sanitizeOutputForAudit: undefined
          } as AutomationToolContract),
          "input",
          input.input || {}
        ),
        outputSnapshot: sanitizeToolSnapshot(
          {
            status: final.status,
            data: final.displayData,
            warnings: final.warnings,
            modelResult,
            resultDiff: diffInternalVsModel(final, modelResult),
            resultCount: final.metrics.resultCount ?? null
          },
          AUTOMATION_TOOL_SNAPSHOT_MAX_BYTES
        ),
        errorSnapshot: extras?.errorSnapshot || null,
        attemptCount: attempts,
        timeoutMs: manifest.timeoutPolicy.timeoutMs,
        durationMs,
        confirmationStatus:
          extras?.confirmationStatus || final.confirmationStatus || "none",
        sideEffectCommitted,
        rollbackStatus,
        startedAt: new Date(started),
        finishedAt: new Date()
      });
    }

    if (lockKey) {
      await releaseToolLock(lockKey);
    }

    return final;
  };

  try {
    const resolved = resolveTool(input.toolId, input.toolVersion, input.tool);
    const tool = resolved.tool;
    manifest = resolved.manifest;

    const manifestErrors = validateToolManifest(manifest);
    if (manifestErrors.length) {
      throw new Error(`TOOL_VALIDATION: ${manifestErrors.join(",")}`);
    }

    await emitToolEvent({
      companyId: input.ctx.companyId,
      eventName: "ToolExecutionRequested",
      toolId: manifest.id,
      toolVersion: manifest.version,
      automationExecutionId: input.ctx.automationExecutionId,
      payload: { source: input.ctx.source, executionId }
    });

    // Allowlist obrigatória para Function Calling
    if (
      input.ctx.source === "ai_function_call" ||
      input.ctx.source === "simulator" ||
      input.ctx.source === "shadow" ||
      input.ctx.source === "live"
    ) {
      assertToolInAllowlist({
        toolId: manifest.id,
        toolVersion: manifest.version,
        allowedToolKeys: input.ctx.allowedToolKeys
      });
    }

    if (
      isToolCircuitOpen(
        input.ctx.companyId,
        manifest.id,
        manifest.version
      )
    ) {
      throw new Error("TOOL_CIRCUIT_OPEN: circuit_open");
    }

    const rate = checkToolRateLimit({
      policy: manifest.rateLimitPolicy,
      ctx: input.ctx,
      toolId: manifest.id
    });
    if (!rate.allowed) {
      throw new Error(
        `TOOL_RATE_LIMIT: retry_after_${rate.retryAfterSeconds}s`
      );
    }

    const decision = evaluateToolPolicy({
      manifest,
      ctx: input.ctx,
      companyPolicy: input.companyPolicy
    });
    policyReason = decision.reason;
    permissionDecision = decision.permissionDecision;
    featureDecision = decision.featureDecision;

    await emitToolEvent({
      companyId: input.ctx.companyId,
      eventName: "ToolPolicyEvaluated",
      toolId: manifest.id,
      toolVersion: manifest.version,
      automationExecutionId: input.ctx.automationExecutionId,
      payload: { ...decision }
    });

    if (!decision.allowed) {
      await emitToolEvent({
        companyId: input.ctx.companyId,
        eventName: "ToolExecutionDenied",
        toolId: manifest.id,
        toolVersion: manifest.version,
        automationExecutionId: input.ctx.automationExecutionId,
        payload: { reason: decision.reason }
      });

      if (decision.reason === "confirmation_required") {
        await emitToolEvent({
          companyId: input.ctx.companyId,
          eventName: "ToolConfirmationRequested",
          toolId: manifest.id,
          toolVersion: manifest.version,
          automationExecutionId: input.ctx.automationExecutionId,
          payload: { policy: manifest.requiresConfirmation }
        });
        return finish(
          makeToolResult({
            status: "waiting_confirmation",
            data: { reason: decision.reason },
            displayData: { reason: decision.reason },
            logs: [`denied:${decision.reason}`],
            confirmationStatus: "pending",
            metrics: {
              durationMs: 0,
              attempts: 0,
              timedOut: false,
              retries: 0,
              rolledBack: false
            }
          }),
          { confirmationStatus: "pending" }
        );
      }

      const status =
        decision.reason === "observe_no_execution" ||
        decision.reason.startsWith("shadow_")
          ? "skipped"
          : "denied";

      return finish(
        makeToolResult({
          status,
          data: { reason: decision.reason },
          displayData: { reason: decision.reason },
          logs: [`denied:${decision.reason}`],
          errors: [
            {
              code: "POLICY",
              type: "policy",
              message: decision.reason,
              retryable: false
            }
          ],
          metrics: {
            durationMs: 0,
            attempts: 0,
            timedOut: false,
            retries: 0,
            rolledBack: false
          }
        })
      );
    }

    // Tenant: companyId obrigatório e coerente
    if (!input.ctx.companyId || input.ctx.companyId < 1) {
      throw new Error("TOOL_TENANT: invalid_company");
    }

    if (typeof tool.validateExecutionContext === "function") {
      await tool.validateExecutionContext(input.ctx);
      logs.push("validateExecutionContext:ok");
    }

    const inputErrors = validateToolSchema(
      manifest.inputSchema,
      input.input || {},
      "input"
    );
    if (inputErrors.length) {
      throw new Error(`TOOL_VALIDATION: ${inputErrors.join(",")}`);
    }

    idempotencyKey = buildToolIdempotencyKey({
      policy: manifest.idempotencyPolicy,
      companyId: input.ctx.companyId,
      toolId: manifest.id,
      toolVersion: manifest.version,
      ctx: input.ctx,
      toolInput: input.input
    });

    if (decision.requireIdempotency && !idempotencyKey) {
      throw new Error("TOOL_IDEMPOTENCY: key_required");
    }

    if (idempotencyKey) {
      const lock = await acquireToolLock({
        companyId: input.ctx.companyId,
        toolId: manifest.id,
        idempotencyKey,
        ttlSeconds: Math.ceil(manifest.timeoutPolicy.timeoutMs / 1000) + 30
      });
      lockKey = lock.key;
      if (!lock.acquired) {
        throw new Error(
          lock.redisUnavailable
            ? "TOOL_IDEMPOTENCY: lock_unavailable"
            : "TOOL_IDEMPOTENCY: duplicate_in_progress"
        );
      }
      logs.push("idempotency_lock:ok");
    }

    if (typeof tool.prepare === "function") {
      await tool.prepare(input.ctx, input.input || {});
      logs.push("prepare:ok");
    }

    await emitToolEvent({
      companyId: input.ctx.companyId,
      eventName: "ToolExecutionStarted",
      toolId: manifest.id,
      toolVersion: manifest.version,
      automationExecutionId: input.ctx.automationExecutionId,
      toolExecutionId: executionId,
      payload: { idempotencyKey }
    });

    const maxRetries = manifest.retryPolicy?.retryable
      ? Math.max(0, Number(manifest.retryPolicy.maxRetries) || 0)
      : 0;
    const backoffMs = Math.max(0, Number(manifest.retryPolicy?.backoffMs) || 0);
    const timeoutMs = manifest.timeoutPolicy.timeoutMs;

    let lastResult: ToolResult | null = null;
    let lastError: unknown = null;
    const errors: ToolResult["errors"] = [];

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      attempts = attempt + 1;
      if (attempt > 0 && backoffMs > 0) {
        await sleep(backoffMs * attempt);
        logs.push(`retry:${attempt}`);
        await emitToolEvent({
          companyId: input.ctx.companyId,
          eventName: "ToolExecutionRetried",
          toolId: manifest.id,
          toolVersion: manifest.version,
          automationExecutionId: input.ctx.automationExecutionId,
          payload: { attempt }
        });
      }
      try {
        lastResult = await executeWithTimeout(
          () => tool.execute(input.ctx, input.input || {}),
          timeoutMs
        );
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const classified = classifyToolError(err);
        if (classified.type === "timeout") timedOut = true;
        errors.push(classified);
        if (
          !manifest.retryPolicy?.retryable ||
          attempt >= maxRetries ||
          classified.retryable === false
        ) {
          break;
        }
      }
    }

    if (lastError != null || !lastResult) {
      if (isWriteSideEffect(manifest.sideEffectType)) {
        sideEffectCommitted = true;
        rollbackStatus = "requested";
        await emitToolEvent({
          companyId: input.ctx.companyId,
          eventName: "ToolRollbackStarted",
          toolId: manifest.id,
          toolVersion: manifest.version,
          automationExecutionId: input.ctx.automationExecutionId,
          payload: {}
        });
        if (typeof tool.rollback === "function") {
          try {
            await tool.rollback(input.ctx, input.input || {});
            rolledBack = true;
            rollbackStatus = "succeeded";
            logs.push("rollback:ok");
            await emitToolEvent({
              companyId: input.ctx.companyId,
              eventName: "ToolRollbackCompleted",
              toolId: manifest.id,
              toolVersion: manifest.version,
              automationExecutionId: input.ctx.automationExecutionId,
              payload: { rollbackStatus }
            });
          } catch (rbErr) {
            rollbackStatus = "failed";
            errors.push({
              code: "ROLLBACK_FAILED",
              type: "rollback_failed",
              message:
                rbErr instanceof Error ? rbErr.message.slice(0, 500) : "rollback_failed",
              retryable: false
            });
            logs.push("rollback:failed");
            recordToolFailure(
              input.ctx.companyId,
              manifest.id,
              manifest.version,
              "rollback_failure"
            );
          }
        } else {
          rollbackStatus = "unsupported";
          logs.push("rollback:unsupported");
        }
      }

      if (typeof tool.cleanup === "function") {
        try {
          await tool.cleanup(input.ctx, input.input || {});
          logs.push("cleanup:ok");
        } catch {
          logs.push("cleanup:failed");
        }
      }

      recordToolFailure(
        input.ctx.companyId,
        manifest.id,
        manifest.version,
        timedOut ? "timeout" : "failure"
      );

      await emitToolEvent({
        companyId: input.ctx.companyId,
        eventName: "ToolExecutionFailed",
        toolId: manifest.id,
        toolVersion: manifest.version,
        automationExecutionId: input.ctx.automationExecutionId,
        payload: { timedOut, rollbackStatus }
      });

      const failMsg =
        lastError instanceof Error
          ? lastError.message
          : String(lastError || "unknown");

      return finish(
        makeToolResult({
          status: "failure",
          data: {},
          displayData: {},
          logs,
          warnings,
          errors,
          sideEffectCommitted,
          rollbackAvailable: typeof tool.rollback === "function",
          metrics: {
            durationMs: 0,
            attempts,
            timedOut,
            retries: Math.max(0, attempts - 1),
            rolledBack
          }
        }),
        {
          errorSnapshot: sanitizeToolSnapshot({
            message: failMsg.slice(0, 500),
            errors
          })
        }
      );
    }

    const outputErrors = validateToolSchema(
      manifest.outputSchema,
      lastResult.data || {},
      "output"
    );
    if (outputErrors.length) {
      throw new Error(`TOOL_VALIDATION: ${outputErrors.join(",")}`);
    }

    if (typeof tool.cleanup === "function") {
      try {
        await tool.cleanup(input.ctx, input.input || {});
        logs.push("cleanup:ok");
      } catch {
        logs.push("cleanup:failed");
      }
    }

    recordToolSuccess(input.ctx.companyId, manifest.id, manifest.version);

    if (isWriteSideEffect(manifest.sideEffectType)) {
      sideEffectCommitted = lastResult.sideEffectCommitted === true;
    }

    // Resultado vivo preserva data/displayData da Tool.
    // sanitizeOutputForAudit aplica-se só na persistência/auditoria (finish).
    await emitToolEvent({
      companyId: input.ctx.companyId,
      eventName: "ToolExecutionCompleted",
      toolId: manifest.id,
      toolVersion: manifest.version,
      automationExecutionId: input.ctx.automationExecutionId,
      toolExecutionId: executionId,
      payload: { status: lastResult.status }
    });

    return finish({
      ...lastResult,
      status: lastResult.status || "success",
      data: lastResult.data || {},
      displayData: lastResult.displayData || lastResult.data || {},
      logs: [...logs, ...(lastResult.logs || [])],
      warnings: [...warnings, ...(lastResult.warnings || [])],
      errors: lastResult.errors || [],
      sideEffectCommitted,
      rollbackAvailable: typeof tool.rollback === "function",
      metrics: {
        durationMs: 0,
        attempts,
        timedOut,
        retries: Math.max(0, attempts - 1),
        rolledBack,
        resultCount: lastResult.metrics?.resultCount,
        emptyResult: lastResult.metrics?.emptyResult,
        cacheHit: lastResult.metrics?.cacheHit,
        cacheMiss: lastResult.metrics?.cacheMiss
      }
    });
  } catch (err) {
    const classified = classifyToolError(err);
    if (manifest) {
      recordToolFailure(
        input.ctx.companyId,
        manifest.id,
        manifest.version,
        classified.type === "timeout" ? "timeout" : "failure"
      );
      await emitToolEvent({
        companyId: input.ctx.companyId,
        eventName:
          classified.type === "circuit_open" ||
          classified.type === "policy" ||
          classified.type === "permission" ||
          classified.type === "feature"
            ? "ToolExecutionDenied"
            : "ToolExecutionFailed",
        toolId: manifest.id,
        toolVersion: manifest.version,
        automationExecutionId: input.ctx.automationExecutionId,
        payload: { type: classified.type, code: classified.code }
      });
    }

    const status =
      classified.type === "policy" ||
      classified.type === "permission" ||
      classified.type === "feature" ||
      classified.type === "circuit_open"
        ? "denied"
        : "failure";

    return finish(
      makeToolResult({
        status,
        data: {},
        displayData: {},
        logs,
        errors: [classified],
        metrics: {
          durationMs: 0,
          attempts,
          timedOut: classified.type === "timeout",
          retries: Math.max(0, attempts - 1),
          rolledBack
        }
      }),
      {
        errorSnapshot: sanitizeToolSnapshot({
          type: classified.type,
          code: classified.code,
          message: classified.message
        })
      }
    );
  }
}

export default { runToolViaRuntime };
