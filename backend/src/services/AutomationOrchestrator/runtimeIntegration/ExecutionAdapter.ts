import { createHash } from "crypto";
import { ActionType } from "../../../config/automationActionExecutionConstants";
import { toolIdToProviderFunctionName } from "../../../config/automationFunctionCallingConstants";
import { RuntimeType } from "../../../config/automationRuntimeIntegrationConstants";
import { getRuntimeIntegrationConfig } from "./RuntimeIntegrationConfig";
import { ExecutionAction } from "../cognitive/action/actionTypes";
import { RuntimeExecutionRequest } from "./types";

const ACTION_OPERATION: Record<ActionType, string> = {
  SEARCH: "search",
  VALIDATE: "validate",
  TRANSFER: "transfer",
  UPDATE: "update",
  SEND_MESSAGE: "send_message",
  WAIT_CONFIRMATION: "wait_confirmation",
  WAIT_INPUT: "wait_input",
  CUSTOM: "custom"
};

function entitiesToParameters(
  action: ExecutionAction
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    objective: action.objective,
    expectedOutcome: action.expectedOutcome
  };
  for (const entity of action.entities) {
    params[entity.key] = entity.value;
  }
  if (action.metadata?.parameters) {
    Object.assign(params, action.metadata.parameters as object);
  }
  return params;
}

function newRequestId(actionId: string): string {
  return `rreq_${createHash("sha256")
    .update(`${actionId}:${Date.now()}`)
    .digest("hex")
    .slice(0, 14)}`;
}

/**
 * ExecutionAdapter — converte ExecutionAction em RuntimeExecutionRequest.
 * Não executa runtime.
 */
export function adaptExecutionActionToRuntimeRequest(input: {
  action: ExecutionAction;
  companyId: number;
  executionId?: string;
  runtimeType?: RuntimeType;
}): RuntimeExecutionRequest {
  const config = getRuntimeIntegrationConfig(input.companyId);
  const operation =
    (input.action.metadata?.operation as string) ||
    ACTION_OPERATION[input.action.actionType] ||
    "custom";

  return {
    requestId: newRequestId(input.action.id),
    actionId: input.action.id,
    executionId:
      input.executionId ||
      `exec_${createHash("sha256").update(input.action.stepId).digest("hex").slice(0, 10)}`,
    runtimeType:
      input.runtimeType || config.dispatcher.defaultRuntimeType,
    operation,
    entities: input.action.entities,
    parameters: entitiesToParameters(input.action),
    constraints: input.action.constraints,
    timeout: config.timeouts.toolRuntimeMs,
    retryPolicy: {
      maxAttempts: config.retry.maxAttempts,
      backoffMs: config.retry.backoffMs
    },
    confirmationPolicy: {
      required: input.action.requiresConfirmation,
      confirmed: Boolean(input.action.metadata?.confirmed)
    },
    metadata: {
      actionType: input.action.actionType,
      stepId: input.action.stepId,
      retryable: input.action.retryable,
      providerFunctionHint:
        input.action.metadata?.toolId &&
        toolIdToProviderFunctionName(String(input.action.metadata.toolId)),
      ...input.action.metadata
    }
  };
}

export default { adaptExecutionActionToRuntimeRequest };
