import { logger } from "../../../utils/logger";
import { sanitizeToolSnapshot } from "./sanitizeToolSnapshot";
import { AUTOMATION_TOOL_SNAPSHOT_MAX_BYTES } from "../../../config/automationToolConstants";

export type PersistToolExecutionInput = {
  companyId: number;
  toolId: string;
  toolVersion: string;
  category: string;
  source: string;
  riskLevel: string;
  sideEffectType: string;
  status: string;
  controlMode: string;
  executionOwner: string;
  automationExecutionId: number | null;
  actionExecutionId: string | null;
  ticketId: number | null;
  contactId: number | null;
  messageId: string | null;
  requestId: string | null;
  correlationId: string | null;
  idempotencyKey: string | null;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot: Record<string, unknown>;
  errorSnapshot: Record<string, unknown> | null;
  attemptCount: number;
  timeoutMs: number;
  durationMs: number;
  confirmationStatus: string;
  sideEffectCommitted: boolean;
  rollbackStatus: string;
  startedAt: Date;
  finishedAt: Date;
};

/**
 * Persistência fail-open: não derruba a execução se o DB falhar.
 * Constraint de idempotência tratada quando chave presente.
 */
export async function persistToolExecution(
  input: PersistToolExecutionInput
): Promise<number | null> {
  try {
    const AutomationToolExecution = (
      await import("../../../models/AutomationToolExecution")
    ).default;

    const payload = {
      companyId: input.companyId,
      toolId: input.toolId,
      toolVersion: input.toolVersion,
      category: input.category,
      source: input.source,
      riskLevel: input.riskLevel,
      sideEffectType: input.sideEffectType,
      status: input.status,
      controlMode: input.controlMode,
      executionOwner: input.executionOwner,
      automationExecutionId: input.automationExecutionId,
      actionExecutionId: input.actionExecutionId,
      ticketId: input.ticketId,
      contactId: input.contactId,
      messageId: input.messageId,
      requestId: input.requestId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      inputSnapshot: sanitizeToolSnapshot(
        input.inputSnapshot,
        AUTOMATION_TOOL_SNAPSHOT_MAX_BYTES
      ),
      outputSnapshot: sanitizeToolSnapshot(
        input.outputSnapshot,
        AUTOMATION_TOOL_SNAPSHOT_MAX_BYTES
      ),
      errorSnapshot: input.errorSnapshot
        ? sanitizeToolSnapshot(
            input.errorSnapshot,
            AUTOMATION_TOOL_SNAPSHOT_MAX_BYTES
          )
        : null,
      attemptCount: input.attemptCount,
      timeoutMs: input.timeoutMs,
      durationMs: input.durationMs,
      confirmationStatus: input.confirmationStatus,
      sideEffectCommitted: input.sideEffectCommitted,
      rollbackStatus: input.rollbackStatus,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt
    };

    if (input.idempotencyKey) {
      const existing = await AutomationToolExecution.findOne({
        where: {
          companyId: input.companyId,
          toolId: input.toolId,
          idempotencyKey: input.idempotencyKey
        }
      });
      if (existing) {
        // Não duplica side effect — retorna registro existente.
        return existing.id;
      }
    }

    const row = await AutomationToolExecution.create(payload);
    return row.id;
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        toolId: input.toolId
      },
      "[AutomationTools] persistToolExecution fail-open"
    );
    return null;
  }
}

export default persistToolExecution;
