import AutomationExecutionEvent from "../../models/AutomationExecutionEvent";
import { logger } from "../../utils/logger";
import { sanitizeAutomationPayload } from "./sanitizeAutomationPayload";

export type EmitAutomationEventInput = {
  companyId: number;
  executionId: number;
  stepId?: number | null;
  eventName: string;
  payload?: Record<string, unknown> | null;
};

/**
 * Persiste evento de execução; falha aberta (não propaga).
 */
export async function emitAutomationEvent(
  input: EmitAutomationEventInput
): Promise<void> {
  try {
    await AutomationExecutionEvent.create({
      companyId: input.companyId,
      executionId: input.executionId,
      stepId: input.stepId ?? null,
      eventName: input.eventName,
      payload: sanitizeAutomationPayload(input.payload || {})
    });
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        executionId: input.executionId,
        eventName: input.eventName
      },
      "[AutomationOrchestrator] emitAutomationEvent fail-open"
    );
  }
}

export default emitAutomationEvent;
