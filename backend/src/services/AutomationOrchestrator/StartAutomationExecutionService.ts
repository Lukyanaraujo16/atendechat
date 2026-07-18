import { Op } from "sequelize";
import {
  AUTOMATION_DEFAULT_CONTROL_MODE,
  AUTOMATION_PLANNER_VERSION,
  AutomationControlMode
} from "../../config/automationOrchestratorConstants";
import AutomationExecution from "../../models/AutomationExecution";
import { logger } from "../../utils/logger";
import { planAutomation } from "./AutomationPlanner";
import { runAutomationExecution } from "./AutomationExecutionEngine";
import { registerBuiltinActions } from "./registerBuiltinActions";
import { sanitizeAutomationPayload } from "./sanitizeAutomationPayload";
import { ExecutionContext } from "./types";
import { ResolveOrchestratorSettingsService } from "./activation/ResolveOrchestratorSettingsService";
import { resolveOwnership } from "./activation/resolveOwnership";
import {
  isCircuitOpen,
  safeRecordCriticalDivergence
} from "./activation/circuitBreaker";
import { safeRecordPlannerValidation } from "./activation/recordPlannerValidation";
import { emitAutomationEvent } from "./EventBus";

export type StartAutomationExecutionInput = {
  companyId: number;
  channel?: string;
  messageId?: string | null;
  ticketId?: number | null;
  contactId?: number | null;
  whatsappId?: number | null;
  controlMode?: AutomationControlMode;
  executionContext: ExecutionContext;
  metadata?: Record<string, unknown>;
  runEngine?: boolean;
};

const RUNNABLE_MODES = new Set<AutomationControlMode>([
  "observe",
  "shadow_execute",
  "active_partial",
  "active"
]);

async function cancelOtherTicketExecutions(input: {
  companyId: number;
  ticketId: number;
  excludeId?: number;
  controlMode: string;
}): Promise<void> {
  if (input.controlMode !== "observe") return;
  try {
    await AutomationExecution.update(
      {
        status: "cancelled",
        finishedAt: new Date(),
        errorCode: "SUPERSEDED",
        errorMessage: "Cancelled by newer observe execution"
      },
      {
        where: {
          companyId: input.companyId,
          ticketId: input.ticketId,
          status: { [Op.in]: ["queued", "running", "waiting"] },
          ...(input.excludeId ? { id: { [Op.ne]: input.excludeId } } : {})
        }
      }
    );
  } catch (err) {
    logger.warn(
      { err, ticketId: input.ticketId },
      "[AutomationOrchestrator] cancelOtherTicketExecutions fail-open"
    );
  }
}

export async function StartAutomationExecutionService(
  input: StartAutomationExecutionInput
): Promise<AutomationExecution | null> {
  registerBuiltinActions();

  const channel = input.channel || "whatsapp";
  const whatsappId = input.whatsappId ?? input.executionContext.whatsappId ?? null;
  const aiAgentId =
    input.executionContext.aiAgent?.id ??
    input.executionContext.ticket?.aiAgentId ??
    null;

  const settings = await ResolveOrchestratorSettingsService({
    companyId: input.companyId,
    whatsappId,
    aiAgentId
  });

  const controlMode: AutomationControlMode =
    input.controlMode ||
    input.executionContext.controlMode ||
    settings.controlMode ||
    AUTOMATION_DEFAULT_CONTROL_MODE;

  if (controlMode === "disabled" || !settings.enabled) {
    logger.info(
      { companyId: input.companyId, controlMode, enabled: settings.enabled },
      "[AutomationOrchestrator] start skipped — disabled"
    );
    return null;
  }

  if (input.messageId) {
    const existing = await AutomationExecution.findOne({
      where: {
        companyId: input.companyId,
        channel,
        messageId: input.messageId
      }
    });
    if (existing) return existing;
  }

  const circuitOpen = isCircuitOpen(input.companyId, settings);
  const ownershipResult = resolveOwnership({
    controlMode,
    circuitOpen,
    settingsEnabled: settings.enabled
  });

  /**
   * Nota de segurança (2.0.1): mesmo com ownership=orchestrator em active/active_partial,
   * actions com sideEffects (chatbot/flow/handoff/send_message) NÃO estão wired ao WhatsApp.
   * send_message permanece legacy por default; capability policy bloqueia side effects reais.
   */
  const capabilities = settings.capabilities;
  const ownership = ownershipResult.ownership;
  const fallbackToLegacy = ownership === "legacy";

  const ctx: ExecutionContext = {
    ...input.executionContext,
    companyId: input.companyId,
    channel,
    messageId: input.messageId ?? input.executionContext.messageId,
    whatsappId: whatsappId ?? input.executionContext.whatsappId,
    controlMode,
    metadata: {
      ...input.executionContext.metadata,
      ownership,
      ownershipReason: ownershipResult.reason,
      capabilitiesSnapshot: capabilities,
      settingsFromDefaults: settings.fromDefaults,
      // Documenta que side effects de send_message não estão ativos.
      sendMessageSideEffectsWired: false
    }
  };

  const planStarted = Date.now();
  const plan = planAutomation(ctx);
  const sanitizedCtx = sanitizeAutomationPayload(
    ctx as unknown as Record<string, unknown>
  );

  const execution = await AutomationExecution.create({
    companyId: input.companyId,
    ticketId: input.ticketId ?? ctx.ticketId ?? null,
    contactId: input.contactId ?? ctx.contactId ?? null,
    whatsappId: whatsappId ?? null,
    channel,
    messageId: input.messageId ?? null,
    status: "queued",
    controlMode,
    plannerVersion: plan.version || AUTOMATION_PLANNER_VERSION,
    currentStep: null,
    intent: plan.intent,
    executionContext: sanitizedCtx,
    plan: plan as unknown as Record<string, unknown>,
    graph: null,
    metadata: sanitizeAutomationPayload({
      ...(input.metadata || {}),
      ownershipReason: ownershipResult.reason
    }),
    ownership,
    capabilitiesSnapshot: capabilities,
    fallbackToLegacy,
    circuitBreakerTripped: circuitOpen,
    plannerValidationId: null
  });

  await emitAutomationEvent({
    companyId: input.companyId,
    executionId: execution.id,
    eventName: "OwnershipResolved",
    payload: {
      ownership,
      reason: ownershipResult.reason,
      controlMode,
      circuitOpen
    }
  });

  const validation = await safeRecordPlannerValidation({
    companyId: input.companyId,
    executionId: execution.id,
    ticketId: execution.ticketId,
    whatsappId: execution.whatsappId,
    messageId: execution.messageId,
    plan,
    ctx,
    ownership,
    controlMode,
    processingTimeMs: Date.now() - planStarted
  });

  if (validation) {
    await emitAutomationEvent({
      companyId: input.companyId,
      executionId: execution.id,
      eventName: "PlannerValidated",
      payload: {
        matched: validation.matched,
        severity: validation.divergenceSeverity,
        plannedIntent: validation.plannedIntent,
        legacyIntent: validation.legacyIntent
      }
    });
    if (validation.divergenceSeverity === "critical") {
      safeRecordCriticalDivergence(input.companyId);
    }
  }

  if (execution.ticketId != null) {
    await cancelOtherTicketExecutions({
      companyId: input.companyId,
      ticketId: execution.ticketId,
      excludeId: execution.id,
      controlMode
    });
  }

  const shouldRun =
    input.runEngine !== false && RUNNABLE_MODES.has(controlMode);

  if (shouldRun) {
    await runAutomationExecution(execution.id, input.companyId);
    return (await AutomationExecution.findOne({
      where: { id: execution.id, companyId: input.companyId }
    })) as AutomationExecution;
  }

  return execution;
}

/**
 * Entrada fail-open para hooks de produção.
 */
export async function safeStartAutomationExecution(
  input: StartAutomationExecutionInput
): Promise<AutomationExecution | null> {
  try {
    return await StartAutomationExecutionService(input);
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        messageId: input.messageId,
        ticketId: input.ticketId
      },
      "[AutomationOrchestrator] safeStartAutomationExecution fail-open"
    );
    return null;
  }
}

export default StartAutomationExecutionService;
