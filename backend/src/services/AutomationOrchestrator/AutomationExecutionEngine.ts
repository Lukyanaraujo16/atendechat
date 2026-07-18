import {
  AUTOMATION_CIRCUIT_BREAKER,
  AutomationControlMode
} from "../../config/automationOrchestratorConstants";
import AutomationExecution from "../../models/AutomationExecution";
import AutomationExecutionStep from "../../models/AutomationExecutionStep";
import { logger } from "../../utils/logger";
import { getAction } from "./ActionRegistry";
import {
  canExecuteAction,
  mergeCapabilities,
  CapabilityMap
} from "./activation/capabilityPolicy";
import {
  isCircuitOpen,
  recordSuccess,
  safeRecordFailure
} from "./activation/circuitBreaker";
import { emitAutomationEvent } from "./EventBus";
import { registerBuiltinActions } from "./registerBuiltinActions";
import { sanitizeAutomationPayload } from "./sanitizeAutomationPayload";
import {
  ActionResult,
  AutomationPlan,
  ExecutionContext,
  GraphEdge,
  GraphNode,
  PlanStep
} from "./types";

export function buildGraphFromSteps(
  steps: Array<{
    stepIndex: number;
    actionName: string;
    status?: string;
    resultStatus?: string | null;
  }>
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const sorted = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
  const nodes: GraphNode[] = sorted.map(s => ({
    id: `step-${s.stepIndex}`,
    label: s.actionName,
    stepIndex: s.stepIndex,
    status: s.status,
    resultStatus: s.resultStatus ?? null
  }));
  const edges: GraphEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({
      id: `edge-${nodes[i].stepIndex}-${nodes[i + 1].stepIndex}`,
      from: nodes[i].id,
      to: nodes[i + 1].id
    });
  }
  return { nodes, edges };
}

function mergeContextData(
  ctx: ExecutionContext,
  data?: Record<string, unknown>
): ExecutionContext {
  if (!data) return ctx;
  const next: ExecutionContext = {
    ...ctx,
    metadata: { ...ctx.metadata },
    knowledge: { ...ctx.knowledge },
    variables: { ...ctx.variables }
  };

  if (typeof data.intent === "string") {
    next.metadata.classifiedIntent = data.intent;
    next.metadata.intent = data.intent;
  }
  if (typeof data.reason === "string") {
    next.metadata.classifyReason = data.reason;
  }
  if (data.wouldRetrieve != null) {
    next.knowledge = {
      ...next.knowledge,
      wouldRetrieve: data.wouldRetrieve,
      mode: data.mode
    };
  }
  Object.assign(next.metadata, sanitizeAutomationPayload(data));
  return next;
}

function resolveCapabilitiesFromCtx(ctx: ExecutionContext): CapabilityMap {
  const snap =
    (ctx.metadata?.capabilitiesSnapshot as Record<string, string> | undefined) ||
    undefined;
  return mergeCapabilities(snap);
}

async function findOrCreateStep(input: {
  companyId: number;
  executionId: number;
  stepIndex: number;
  actionName: string;
}): Promise<AutomationExecutionStep> {
  const existing = await AutomationExecutionStep.findOne({
    where: {
      companyId: input.companyId,
      executionId: input.executionId,
      stepIndex: input.stepIndex
    }
  });
  if (existing) return existing;
  return AutomationExecutionStep.create({
    companyId: input.companyId,
    executionId: input.executionId,
    stepIndex: input.stepIndex,
    actionName: input.actionName,
    status: "pending"
  });
}

async function tryFinishFallback(
  ctx: ExecutionContext
): Promise<ActionResult | null> {
  const finish = getAction("FinishExecution");
  if (!finish) return null;
  try {
    await finish.validate(ctx);
    return finish.execute(ctx);
  } catch {
    return null;
  }
}

async function executeWithTimeout(
  fn: () => Promise<ActionResult>,
  timeoutMs: number
): Promise<ActionResult> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      fn(),
      new Promise<ActionResult>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error("ACTION_TIMEOUT"));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Executa (ou retoma) uma AutomationExecution passo a passo.
 */
export async function runAutomationExecution(
  executionId: number,
  companyId: number
): Promise<AutomationExecution | null> {
  registerBuiltinActions();

  let execution: AutomationExecution | null = null;
  try {
    execution = await AutomationExecution.findOne({
      where: { id: executionId, companyId }
    });
  } catch (err) {
    logger.warn(
      { err, executionId, companyId },
      "[AutomationOrchestrator] load execution fail-open"
    );
    return null;
  }

  if (!execution) return null;

  const plan = (execution.plan || {}) as AutomationPlan;
  const planSteps: PlanStep[] = Array.isArray(plan.steps) ? plan.steps : [];
  if (planSteps.length === 0) {
    await execution.update({
      status: "failed",
      errorCode: "EMPTY_PLAN",
      errorMessage: "Plan has no steps",
      finishedAt: new Date()
    });
    await emitAutomationEvent({
      companyId,
      executionId,
      eventName: "ExecutionFailed",
      payload: { errorCode: "EMPTY_PLAN" }
    });
    return execution;
  }

  let ctx = (execution.executionContext || {}) as ExecutionContext;
  const capabilities = resolveCapabilitiesFromCtx(ctx);
  ctx = {
    ...ctx,
    metadata: {
      ...ctx.metadata,
      ownership: execution.ownership || ctx.metadata?.ownership || "legacy",
      capabilitiesSnapshot: capabilities
    }
  };

  // Circuit breaker: fail-open para legado.
  if (isCircuitOpen(companyId)) {
    try {
      await execution.update({
        status: "cancelled",
        fallbackToLegacy: true,
        circuitBreakerTripped: true,
        ownership: "legacy",
        finishedAt: new Date(),
        errorCode: "CIRCUIT_BREAKER",
        errorMessage: "Circuit breaker open — fallback to legacy"
      });
    } catch (err) {
      logger.warn(
        { err, executionId },
        "[AutomationOrchestrator] circuit trip update fail-open"
      );
    }
    await emitAutomationEvent({
      companyId,
      executionId,
      eventName: "CircuitBreakerTripped",
      payload: { fallbackToLegacy: true }
    });
    await emitAutomationEvent({
      companyId,
      executionId,
      eventName: "FallbackToLegacy",
      payload: { reason: "circuit_breaker_open" }
    });
    return execution.reload().catch(() => execution);
  }

  const resumeFromWaiting = execution.status === "waiting";
  let startIndex = 0;
  if (
    resumeFromWaiting &&
    execution.currentStep != null &&
    Number.isFinite(execution.currentStep)
  ) {
    startIndex = Number(execution.currentStep) + 1;
  } else if (
    execution.currentStep != null &&
    execution.status === "running" &&
    Number.isFinite(execution.currentStep)
  ) {
    startIndex = Number(execution.currentStep);
  }

  const now = new Date();
  try {
    await execution.update({
      status: "running",
      startedAt: execution.startedAt || now,
      errorCode: null,
      errorMessage: null
    });
  } catch (err) {
    logger.warn(
      { err, executionId },
      "[AutomationOrchestrator] set running fail-open"
    );
  }

  await emitAutomationEvent({
    companyId,
    executionId,
    eventName: resumeFromWaiting ? "ExecutionResumed" : "ExecutionStarted",
    payload: { startIndex, controlMode: execution.controlMode }
  });

  const stepRecords: AutomationExecutionStep[] = [];
  const controlMode = (ctx.controlMode ||
    execution.controlMode ||
    "observe") as AutomationControlMode;

  for (let i = startIndex; i < planSteps.length; i += 1) {
    const planStep = planSteps[i];
    const actionName = planStep.actionName;
    const stepStarted = Date.now();

    let step: AutomationExecutionStep;
    try {
      step = await findOrCreateStep({
        companyId,
        executionId,
        stepIndex: planStep.index ?? i,
        actionName
      });
      await step.update({
        status: "running",
        actionName,
        startedAt: new Date(),
        inputPreview: sanitizeAutomationPayload({
          actionName,
          params: planStep.params || {},
          controlMode: ctx.controlMode
        })
      });
    } catch (err) {
      logger.warn(
        { err, executionId, actionName },
        "[AutomationOrchestrator] step create fail-open"
      );
      break;
    }

    await emitAutomationEvent({
      companyId,
      executionId,
      stepId: step.id,
      eventName: "ActionStarted",
      payload: { actionName, stepIndex: planStep.index ?? i }
    });

    const action = getAction(actionName);
    let result: ActionResult;

    if (!action) {
      result = {
        status: "failure",
        message: `action_not_found:${actionName}`,
        nextHint: "fallback"
      };
    } else {
      const gate = canExecuteAction({
        controlMode,
        capabilities,
        actionName,
        actionMeta: action
      });

      if (!gate.allowed) {
        result = {
          status: "skip",
          message: gate.reason,
          data: {
            effectiveMode: gate.effectiveMode,
            capabilityBlocked: true
          },
          nextHint: "continue"
        };
        await emitAutomationEvent({
          companyId,
          executionId,
          stepId: step.id,
          eventName: "CapabilityBlocked",
          payload: {
            actionName,
            reason: gate.reason,
            effectiveMode: gate.effectiveMode
          }
        });
      } else {
        try {
          await action.validate(ctx, planStep.params);
          result = await executeWithTimeout(
            () => action.execute(ctx, planStep.params),
            AUTOMATION_CIRCUIT_BREAKER.maxLatencyMs
          );
          recordSuccess(companyId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const isTimeout = message === "ACTION_TIMEOUT";
          safeRecordFailure(companyId, isTimeout ? "timeout" : "failure");
          result = {
            status: "failure",
            message: message.slice(0, 500),
            nextHint: "fallback"
          };
        }
      }
    }

    const durationMs = Date.now() - stepStarted;
    if (durationMs > AUTOMATION_CIRCUIT_BREAKER.maxLatencyMs) {
      safeRecordFailure(companyId, "timeout");
    }

    const outputPreview = sanitizeAutomationPayload({
      status: result.status,
      message: result.message,
      ...(result.data || {}),
      nextHint: result.nextHint
    });

    try {
      await step.update({
        status:
          result.status === "failure"
            ? "failed"
            : result.status === "waiting"
              ? "waiting"
              : result.status === "skip"
                ? "skipped"
                : "completed",
        resultStatus: result.status,
        outputPreview,
        durationMs,
        finishedAt: new Date(),
        errorCode: result.status === "failure" ? "ACTION_FAILURE" : null,
        errorMessage:
          result.status === "failure" ? (result.message || null) : null
      });
    } catch (err) {
      logger.warn(
        { err, stepId: step.id },
        "[AutomationOrchestrator] step update fail-open"
      );
    }

    await emitAutomationEvent({
      companyId,
      executionId,
      stepId: step.id,
      eventName: "ActionFinished",
      payload: {
        actionName,
        status: result.status,
        nextHint: result.nextHint,
        durationMs
      }
    });

    ctx = mergeContextData(ctx, result.data);
    stepRecords.push(step);

    const graph = buildGraphFromSteps(
      [...stepRecords].map(s => ({
        stepIndex: s.stepIndex,
        actionName: s.actionName,
        status: s.status,
        resultStatus: s.resultStatus
      }))
    );

    try {
      await execution.update({
        currentStep: planStep.index ?? i,
        executionContext: sanitizeAutomationPayload(
          ctx as unknown as Record<string, unknown>
        ) as unknown as ExecutionContext,
        intent:
          (ctx.metadata.classifiedIntent as string) ||
          execution.intent ||
          plan.intent ||
          null,
        graph
      });
    } catch (err) {
      logger.warn(
        { err, executionId },
        "[AutomationOrchestrator] execution update fail-open"
      );
    }

    if (result.status === "waiting" || result.nextHint === "wait") {
      await execution.update({
        status: "waiting",
        currentStep: planStep.index ?? i
      });
      await emitAutomationEvent({
        companyId,
        executionId,
        stepId: step.id,
        eventName: "ExecutionWaiting",
        payload: { stepIndex: planStep.index ?? i }
      });
      return execution.reload();
    }

    if (result.status === "handoff" || result.nextHint === "handoff") {
      await execution.update({
        status: "handoff",
        finishedAt: new Date(),
        currentStep: planStep.index ?? i
      });
      await emitAutomationEvent({
        companyId,
        executionId,
        stepId: step.id,
        eventName: "HandoffRequested",
        payload: { stepIndex: planStep.index ?? i }
      });
      await emitAutomationEvent({
        companyId,
        executionId,
        eventName: "ExecutionCompleted",
        payload: { status: "handoff" }
      });
      return execution.reload();
    }

    if (result.nextHint === "finish") {
      await execution.update({
        status: "completed",
        finishedAt: new Date(),
        currentStep: planStep.index ?? i
      });
      await emitAutomationEvent({
        companyId,
        executionId,
        eventName: "ExecutionCompleted",
        payload: { status: "completed" }
      });
      return execution.reload();
    }

    if (result.status === "failure") {
      const fallback = await tryFinishFallback(ctx);
      if (fallback && fallback.status !== "failure") {
        await execution.update({
          status: "completed",
          finishedAt: new Date(),
          fallbackToLegacy: true,
          errorCode: "ACTION_FAILURE_RECOVERED",
          errorMessage: result.message || null,
          currentStep: planStep.index ?? i
        });
        await emitAutomationEvent({
          companyId,
          executionId,
          eventName: "FallbackToLegacy",
          payload: { reason: "action_failure_recovered" }
        });
        await emitAutomationEvent({
          companyId,
          executionId,
          eventName: "ExecutionCompleted",
          payload: { status: "completed", recovered: true }
        });
        return execution.reload();
      }

      await execution.update({
        status: "failed",
        finishedAt: new Date(),
        fallbackToLegacy: true,
        errorCode: "ACTION_FAILURE",
        errorMessage: result.message || null,
        currentStep: planStep.index ?? i
      });
      await emitAutomationEvent({
        companyId,
        executionId,
        eventName: "ExecutionFailed",
        payload: { message: result.message, actionName }
      });
      await emitAutomationEvent({
        companyId,
        executionId,
        eventName: "FallbackToLegacy",
        payload: { reason: "action_failure" }
      });
      return execution.reload();
    }
  }

  try {
    await execution.update({
      status: "completed",
      finishedAt: new Date()
    });
  } catch (err) {
    logger.warn(
      { err, executionId },
      "[AutomationOrchestrator] complete fail-open"
    );
  }

  await emitAutomationEvent({
    companyId,
    executionId,
    eventName: "ExecutionCompleted",
    payload: { status: "completed" }
  });

  try {
    return await execution.reload();
  } catch {
    return execution;
  }
}

export default runAutomationExecution;
