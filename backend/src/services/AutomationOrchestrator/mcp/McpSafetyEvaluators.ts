import { McpToolClassification } from "../../../config/automationMcpConstants";

export type FallbackSafety = "SAFE" | "UNSAFE" | "NOT_AVAILABLE";

/**
 * FallbackSafetyEvaluator — não faz fallback após WRITE ambígua.
 */
export function evaluateFallbackSafety(input: {
  allowFallback: boolean;
  toolRuntimeAvailable: boolean;
  classification: McpToolClassification | "READ" | "WRITE" | "UNKNOWN";
  mcpStartedExecution: boolean;
  mcpResultAmbiguous: boolean;
  forceMcpOnly?: boolean;
}): FallbackSafety {
  if (input.forceMcpOnly) return "NOT_AVAILABLE";
  if (!input.allowFallback || !input.toolRuntimeAvailable) return "NOT_AVAILABLE";
  if (
    (input.classification === "WRITE" || input.classification === "UNKNOWN") &&
    (input.mcpStartedExecution || input.mcpResultAmbiguous)
  ) {
    return "UNSAFE";
  }
  return "SAFE";
}

export type RetrySafety = "SAFE" | "UNSAFE";

/**
 * McpRetrySafetyEvaluator — retries só para erros transitórios pré-execução WRITE.
 */
export function evaluateRetrySafety(input: {
  errorCode: string;
  classification: McpToolClassification | string;
  executionConfirmedStarted: boolean;
}): RetrySafety {
  const transient = [
    "ERR_MCP_CONNECTION_TIMEOUT",
    "ERR_MCP_CONNECTION_FAILED",
    "ERR_MCP_RATE_LIMIT",
    "ERR_MCP_UNHEALTHY"
  ];
  if (!transient.includes(input.errorCode)) return "UNSAFE";
  if (
    (input.classification === "WRITE" || input.classification === "UNKNOWN") &&
    input.executionConfirmedStarted
  ) {
    return "UNSAFE";
  }
  return "SAFE";
}

export default { evaluateFallbackSafety, evaluateRetrySafety };
