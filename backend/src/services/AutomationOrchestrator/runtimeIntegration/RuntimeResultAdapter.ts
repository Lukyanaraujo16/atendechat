import { ActionExecutionResult } from "../cognitive/action/actionTypes";
import { ActionType } from "../../../config/automationActionExecutionConstants";
import {
  RuntimeAdapterResult,
  RuntimeExecutionRequest
} from "./types";

function mapStatus(
  adapterStatus: RuntimeAdapterResult["status"]
): ActionExecutionResult["status"] {
  if (adapterStatus === "success") return "SUCCESS";
  if (adapterStatus === "waiting") return "WAITING";
  if (adapterStatus === "timeout") return "FAILED";
  if (adapterStatus === "denied") return "FAILED";
  return "FAILED";
}

function mapValidation(
  adapterStatus: RuntimeAdapterResult["status"]
): ActionExecutionResult["validation"] {
  if (adapterStatus === "waiting") return "WAITING";
  if (adapterStatus === "success") return "VALID";
  if (adapterStatus === "denied") return "PARTIAL";
  return "FAILED";
}

/**
 * RuntimeResultAdapter — converte resultado do Runtime em ActionExecutionResult.
 * O Core Cognitivo não depende do formato Tool Runtime.
 */
export function adaptRuntimeResultToActionResult(input: {
  request: RuntimeExecutionRequest;
  adapterResult: RuntimeAdapterResult;
  startedAt: string;
  finishedAt: string;
}): ActionExecutionResult {
  const { request, adapterResult, startedAt, finishedAt } = input;
  const actionType = (request.metadata?.actionType || "CUSTOM") as ActionType;

  return {
    actionId: request.actionId,
    stepId: String(request.metadata?.stepId || ""),
    actionType,
    strategy: `Runtime:${adapterResult.adapter}`,
    status: mapStatus(adapterResult.status),
    startedAt,
    finishedAt,
    duration: adapterResult.durationMs,
    output: {
      runtimeType: adapterResult.runtimeType,
      capability: adapterResult.capability,
      toolId: adapterResult.toolId,
      modelResult: adapterResult.modelResult || {},
      selection: adapterResult.selection,
      resolution: adapterResult.resolution,
      reusedExistingRuntime: adapterResult.metadata?.reusedExistingRuntime === true
    },
    validation: mapValidation(adapterResult.status),
    metrics: {
      retries: 0,
      simulatedLatencyMs: 0
    },
    errors: adapterResult.errors,
    warnings: adapterResult.warnings,
    metadata: {
      requestId: request.requestId,
      executionId: request.executionId,
      runtimeIntegrated: true,
      usesToolRuntime:
        adapterResult.runtimeType === "TOOL_RUNTIME" &&
        adapterResult.metadata?.skipped !== true,
      usesMcp: adapterResult.runtimeType === "MCP",
      runtimeType: adapterResult.runtimeType,
      executesTools: adapterResult.status === "success",
      adapter: adapterResult.adapter,
      mcpServerId: adapterResult.metadata?.serverId,
      mcpToolName: adapterResult.metadata?.toolName,
      dispatchDecision: request.metadata?.dispatchDecision,
      normalizedMcpResult: adapterResult.internalData?.normalized || null
    }
  };
}

export default { adaptRuntimeResultToActionResult };
