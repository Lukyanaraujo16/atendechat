import AppError from "../../errors/AppError";
import AutomationExecution from "../../models/AutomationExecution";
import { logger } from "../../utils/logger";
import { runAutomationExecution } from "./AutomationExecutionEngine";
import { sanitizeAutomationPayload } from "./sanitizeAutomationPayload";
import { ExecutionContext } from "./types";
import { isCircuitOpen } from "./activation/circuitBreaker";
import { emitAutomationEvent } from "./EventBus";

export type ContinueAutomationExecutionInput = {
  companyId: number;
  executionId: number;
  message?: {
    body?: string | null;
    fromMe?: boolean;
    hasText?: boolean;
    messageId?: string | null;
  };
  metadata?: Record<string, unknown>;
};

export async function ContinueAutomationExecutionService(
  input: ContinueAutomationExecutionInput
): Promise<AutomationExecution> {
  const execution = await AutomationExecution.findOne({
    where: { id: input.executionId, companyId: input.companyId }
  });

  if (!execution) {
    throw new AppError("ERR_AUTOMATION_EXECUTION_NOT_FOUND", 404);
  }

  if (execution.status !== "waiting") {
    throw new AppError("ERR_AUTOMATION_EXECUTION_NOT_WAITING", 400);
  }

  if (isCircuitOpen(input.companyId)) {
    await execution.update({
      status: "cancelled",
      fallbackToLegacy: true,
      circuitBreakerTripped: true,
      ownership: "legacy",
      finishedAt: new Date(),
      errorCode: "CIRCUIT_BREAKER",
      errorMessage: "Circuit breaker open on continue — fallback to legacy"
    });
    await emitAutomationEvent({
      companyId: input.companyId,
      executionId: execution.id,
      eventName: "CircuitBreakerTripped",
      payload: { phase: "continue" }
    });
    await emitAutomationEvent({
      companyId: input.companyId,
      executionId: execution.id,
      eventName: "FallbackToLegacy",
      payload: { reason: "circuit_breaker_on_continue" }
    });
    throw new AppError(
      "ERR_AUTOMATION_CIRCUIT_OPEN",
      503,
      "Circuit breaker aberto — atendimento permanece no legado."
    );
  }

  const ctx = {
    ...(execution.executionContext || {})
  } as ExecutionContext;

  if (input.message) {
    const body = String(input.message.body ?? "");
    ctx.currentMessage = {
      body: body.slice(0, 2000),
      fromMe: input.message.fromMe === true,
      hasText: input.message.hasText ?? body.trim().length > 0
    };
    if (input.message.messageId) {
      ctx.messageId = input.message.messageId;
    }
    const history = Array.isArray(ctx.conversationHistory)
      ? [...ctx.conversationHistory]
      : [];
    history.push({
      role: input.message.fromMe ? "assistant" : "user",
      content: body.slice(0, 2000)
    });
    ctx.conversationHistory = history.slice(-20);
  }

  if (input.metadata) {
    ctx.metadata = {
      ...(ctx.metadata || {}),
      ...sanitizeAutomationPayload(input.metadata)
    };
  }

  await execution.update({
    executionContext: sanitizeAutomationPayload(
      ctx as unknown as Record<string, unknown>
    ),
    metadata: {
      ...(execution.metadata || {}),
      ...sanitizeAutomationPayload(input.metadata || {})
    }
  });

  await runAutomationExecution(execution.id, input.companyId);

  const reloaded = await AutomationExecution.findOne({
    where: { id: execution.id, companyId: input.companyId }
  });
  return reloaded as AutomationExecution;
}

export async function safeContinueAutomationExecution(
  input: ContinueAutomationExecutionInput
): Promise<AutomationExecution | null> {
  try {
    return await ContinueAutomationExecutionService(input);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn(
      { err, executionId: input.executionId, companyId: input.companyId },
      "[AutomationOrchestrator] safeContinueAutomationExecution fail-open"
    );
    return null;
  }
}

export default ContinueAutomationExecutionService;
