import {
  ActionManifest,
  ActionOutputContract,
  ActionRuntimeResult,
  AutomationActionContract,
  buildManifest,
  classifyActionError,
  synthesizeManifestFromLegacy
} from "./contracts/ActionContract";
import { ActionResult, ExecutionContext } from "./types";
import {
  AUTOMATION_CIRCUIT_BREAKER,
  AutomationControlMode
} from "../../config/automationOrchestratorConstants";
import {
  canExecuteAction,
  CapabilityMap
} from "./activation/capabilityPolicy";
import { hasCapability } from "./CapabilityRegistry";

export type DefineActionHandlers = {
  execute: AutomationActionContract["execute"];
  supports?: AutomationActionContract["supports"];
  validate?: AutomationActionContract["validate"];
  prepare?: AutomationActionContract["prepare"];
  rollback?: AutomationActionContract["rollback"];
  cleanup?: AutomationActionContract["cleanup"];
};

/**
 * Factory padrão: toda Action passa a ter Manifest + contrato uniforme.
 * execute permanece idêntico ao comportamento anterior.
 */
export function defineAction(
  partial: Partial<ActionManifest> &
    Pick<ActionManifest, "id" | "name" | "category" | "capabilities">,
  handlers: DefineActionHandlers
): AutomationActionContract {
  const manifest = buildManifest(partial);
  const primaryCap = manifest.capabilities[0];

  return {
    name: manifest.name,
    sideEffects: manifest.sideEffects,
    supportsShadow: manifest.supportsShadow,
    supportsObserve: manifest.supportsObserve,
    supportsActive: manifest.supportsActive,
    capability: primaryCap,
    manifest: () => ({ ...manifest }),
    supports: handlers.supports || ((_ctx: ExecutionContext) => true),
    validate: handlers.validate || ((_ctx: ExecutionContext) => undefined),
    prepare: handlers.prepare,
    execute: handlers.execute,
    rollback: handlers.rollback,
    cleanup: handlers.cleanup
  };
}

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
        timer = setTimeout(() => reject(new Error("ACTION_TIMEOUT")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function validateDeclaredInputs(
  manifest: ActionManifest,
  params?: Record<string, unknown>
): void {
  const p = params || {};
  for (const input of manifest.inputs || []) {
    if (!input.required) continue;
    const v = p[input.name];
    if (v === undefined || v === null || v === "") {
      throw new Error(`ACTION_VALIDATION: missing_input:${input.name}`);
    }
  }
}

function validateDependencies(
  manifest: ActionManifest,
  ctx: ExecutionContext
): void {
  for (const cap of manifest.requiresCapabilities || []) {
    if (!hasCapability(cap)) {
      throw new Error(`ACTION_CAPABILITY: missing_capability:${cap}`);
    }
  }
  for (const key of manifest.requiresContext || []) {
    const parts = String(key).split(".");
    let cur: unknown = ctx;
    for (const part of parts) {
      if (cur == null || typeof cur !== "object") {
        throw new Error(`ACTION_VALIDATION: missing_context:${key}`);
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    if (cur === undefined || cur === null) {
      throw new Error(`ACTION_VALIDATION: missing_context:${key}`);
    }
  }
}

export type RunActionViaRuntimeInput = {
  action: AutomationActionContract;
  ctx: ExecutionContext;
  params?: Record<string, unknown>;
  controlMode: AutomationControlMode;
  capabilities: CapabilityMap;
  timeoutCeilingMs?: number;
};

/**
 * Runtime universal. Engine deve usar apenas este caminho.
 * supports() NÃO bloqueia (preserva comportamento 2.0.1).
 */
export async function runActionViaRuntime(
  input: RunActionViaRuntimeInput
): Promise<ActionRuntimeResult> {
  const { action, ctx, params, controlMode, capabilities } = input;
  const manifest =
    typeof action.manifest === "function"
      ? action.manifest()
      : synthesizeManifestFromLegacy(action);

  const logs: string[] = [];
  const errors: ActionOutputContract["errors"] = [];
  let attempts = 0;
  let timedOut = false;
  let rolledBack = false;
  const started = Date.now();

  const ceiling =
    input.timeoutCeilingMs != null && Number.isFinite(input.timeoutCeilingMs)
      ? Number(input.timeoutCeilingMs)
      : AUTOMATION_CIRCUIT_BREAKER.maxLatencyMs;
  const timeoutMs = Math.min(manifest.timeoutMs || ceiling, ceiling);

  const gate = canExecuteAction({
    controlMode,
    capabilities,
    actionName: action.name,
    actionMeta: {
      sideEffects: manifest.sideEffects,
      supportsShadow: manifest.supportsShadow,
      supportsObserve: manifest.supportsObserve,
      supportsActive: manifest.supportsActive,
      capability: manifest.capabilities[0] as any
    }
  });

  if (!gate.allowed) {
    return {
      status: "skip",
      outputs: {
        effectiveMode: gate.effectiveMode,
        capabilityBlocked: true
      },
      metrics: {
        durationMs: Date.now() - started,
        attempts: 0,
        timedOut: false,
        rolledBack: false,
        retries: 0
      },
      logs: [`capability_blocked:${gate.reason}`],
      nextHint: "continue",
      errors: [
        {
          code: "capability",
          message: gate.reason || "capability_blocked",
          retryable: false
        }
      ],
      message: gate.reason,
      data: {
        effectiveMode: gate.effectiveMode,
        capabilityBlocked: true
      },
      legacyResult: {
        status: "skip",
        message: gate.reason,
        data: {
          effectiveMode: gate.effectiveMode,
          capabilityBlocked: true
        },
        nextHint: "continue"
      },
      manifest
    };
  }

  try {
    validateDeclaredInputs(manifest, params);
    validateDependencies(manifest, ctx);
    if (typeof action.validate === "function") {
      await action.validate(ctx, params);
    }
    if (typeof action.prepare === "function") {
      await action.prepare(ctx, params);
      logs.push("prepare:ok");
    }
  } catch (err) {
    const classified = classifyActionError(err, "validation");
    errors.push(classified);
    return {
      status: "failure",
      outputs: {},
      metrics: {
        durationMs: Date.now() - started,
        attempts: 0,
        timedOut: false,
        rolledBack: false,
        retries: 0
      },
      logs,
      nextHint: "fallback",
      errors,
      message: classified.message,
      legacyResult: {
        status: "failure",
        message: classified.message,
        nextHint: "fallback"
      },
      manifest
    };
  }

  const maxRetries = manifest.retryPolicy?.retryable
    ? Math.max(0, Number(manifest.retryPolicy.maxRetries) || 0)
    : 0;
  const backoffMs = Math.max(0, Number(manifest.retryPolicy?.backoffMs) || 0);

  let lastResult: ActionResult | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    attempts = attempt + 1;
    if (attempt > 0 && backoffMs > 0) {
      await sleep(backoffMs * attempt);
      logs.push(`retry:${attempt}`);
    }
    try {
      lastResult = await executeWithTimeout(
        () => action.execute(ctx, params),
        timeoutMs
      );
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      const classified = classifyActionError(err);
      if (classified.code === "timeout") timedOut = true;
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
    if (manifest.rollbackSupported && typeof action.rollback === "function") {
      try {
        await action.rollback(ctx, params);
        rolledBack = true;
        logs.push("rollback:ok");
      } catch (rbErr) {
        errors.push({
          code: "rollback_failed",
          message: rbErr instanceof Error ? rbErr.message : String(rbErr),
          retryable: false
        });
        logs.push("rollback:failed");
      }
    }

    if (typeof action.cleanup === "function") {
      try {
        await action.cleanup(ctx, params);
        logs.push("cleanup:ok");
      } catch {
        logs.push("cleanup:failed");
      }
    }

    const failMsg =
      lastError instanceof Error
        ? lastError.message
        : String(lastError || "unknown");
    return {
      status: "failure",
      outputs: {},
      metrics: {
        durationMs: Date.now() - started,
        attempts,
        timedOut,
        rolledBack,
        retries: Math.max(0, attempts - 1)
      },
      logs,
      nextHint: "fallback",
      errors,
      message: failMsg.slice(0, 500),
      legacyResult: {
        status: "failure",
        message: failMsg.slice(0, 500),
        nextHint: "fallback"
      },
      manifest
    };
  }

  if (typeof action.cleanup === "function") {
    try {
      await action.cleanup(ctx, params);
      logs.push("cleanup:ok");
    } catch {
      logs.push("cleanup:failed");
    }
  }

  return {
    status: lastResult.status,
    outputs: { ...(lastResult.data || {}) },
    metrics: {
      durationMs: Date.now() - started,
      attempts,
      timedOut,
      rolledBack,
      retries: Math.max(0, attempts - 1)
    },
    logs,
    nextHint: lastResult.nextHint,
    errors,
    message: lastResult.message,
    data: lastResult.data,
    legacyResult: {
      status: lastResult.status,
      message: lastResult.message,
      data: lastResult.data,
      nextHint: lastResult.nextHint
    },
    manifest
  };
}

export default {
  defineAction,
  runActionViaRuntime
};
