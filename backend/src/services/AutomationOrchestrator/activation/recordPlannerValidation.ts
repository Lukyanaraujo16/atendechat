import AutomationPlannerValidation from "../../../models/AutomationPlannerValidation";
import AutomationExecution from "../../../models/AutomationExecution";
import { logger } from "../../../utils/logger";
import { AutomationPlan, ExecutionContext } from "../types";
import { comparePlannerVsLegacy } from "./divergenceEngine";
import { inferLegacyDecision } from "./inferLegacyDecision";
import {
  AutomationOwnership,
  AutomationControlMode
} from "../../../config/automationOrchestratorConstants";

export type RecordPlannerValidationInput = {
  companyId: number;
  executionId?: number | null;
  ticketId?: number | null;
  whatsappId?: number | null;
  messageId?: string | null;
  plan: AutomationPlan;
  ctx: ExecutionContext;
  ownership: AutomationOwnership | string;
  controlMode: AutomationControlMode | string;
  processingTimeMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordPlannerValidation(
  input: RecordPlannerValidationInput
): Promise<AutomationPlannerValidation | null> {
  const started = Date.now();
  const legacy = inferLegacyDecision(input.ctx);
  const divergence = comparePlannerVsLegacy(
    input.plan.intent,
    legacy.legacyIntent
  );

  const row = await AutomationPlannerValidation.create({
    companyId: input.companyId,
    ticketId: input.ticketId ?? input.ctx.ticketId ?? null,
    whatsappId: input.whatsappId ?? input.ctx.whatsappId ?? null,
    messageId: input.messageId ?? input.ctx.messageId ?? null,
    executionId: input.executionId ?? null,
    plannedIntent: input.plan.intent,
    plannedActions: (input.plan.steps || []).map(s => s.actionName),
    legacyIntent: legacy.legacyIntent,
    legacyHandler: legacy.legacyHandler,
    legacyResult: null,
    matched: divergence.matched,
    divergenceSeverity: divergence.severity,
    divergenceReason: divergence.reason.slice(0, 240),
    processingTimeMs:
      input.processingTimeMs ?? Date.now() - started,
    ownership: input.ownership || "legacy",
    controlMode: String(input.controlMode),
    metadata: input.metadata || null
  });

  if (input.executionId != null) {
    try {
      await AutomationExecution.update(
        { plannerValidationId: row.id },
        {
          where: {
            id: input.executionId,
            companyId: input.companyId
          }
        }
      );
    } catch (err) {
      logger.warn(
        { err, executionId: input.executionId },
        "[AutomationOrchestrator] link plannerValidationId fail-open"
      );
    }
  }

  return row;
}

export async function safeRecordPlannerValidation(
  input: RecordPlannerValidationInput
): Promise<AutomationPlannerValidation | null> {
  try {
    return await recordPlannerValidation(input);
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        executionId: input.executionId,
        messageId: input.messageId
      },
      "[AutomationOrchestrator] safeRecordPlannerValidation fail-open"
    );
    return null;
  }
}

export default recordPlannerValidation;
