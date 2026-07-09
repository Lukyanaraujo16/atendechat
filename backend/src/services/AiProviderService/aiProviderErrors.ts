import { AiAgentShadowErrorCode } from "../AiAgentService/aiAgentShadowErrors";
import { AI_AGENT_SHADOW_ERROR_CODES } from "../AiAgentService/aiAgentShadowErrors";

function readErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const e = err as Record<string, unknown>;
  const msg = e.message ?? e.statusText;
  return typeof msg === "string" ? msg.toLowerCase() : "";
}

function readErrorStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as Record<string, unknown>;
  const status = e.status ?? e.statusCode;
  if (typeof status === "number") return status;
  if (typeof status === "string" && /^\d+$/.test(status)) return Number(status);
  return null;
}

export function mapGeminiErrorToShadowCode(err: unknown): AiAgentShadowErrorCode {
  const status = readErrorStatus(err);
  const message = readErrorMessage(err);

  if (status === 401 || status === 403) {
    return AI_AGENT_SHADOW_ERROR_CODES.AI_AUTH_ERROR;
  }
  if (status === 429 || message.includes("quota") || message.includes("rate limit")) {
    return AI_AGENT_SHADOW_ERROR_CODES.AI_USAGE_LIMIT_REACHED;
  }
  if (
    status === 400 &&
    (message.includes("model") || message.includes("not found"))
  ) {
    return AI_AGENT_SHADOW_ERROR_CODES.INVALID_MODEL;
  }
  if (message.includes("invalid api key") || message.includes("api key not valid")) {
    return AI_AGENT_SHADOW_ERROR_CODES.AI_AUTH_ERROR;
  }
  return AI_AGENT_SHADOW_ERROR_CODES.PROVIDER_UNAVAILABLE;
}

export function mapOpenAiManagerError(
  error: "OPENAI_LIMIT_REACHED" | "OPENAI_API_ERROR"
): AiAgentShadowErrorCode {
  if (error === "OPENAI_LIMIT_REACHED") {
    return AI_AGENT_SHADOW_ERROR_CODES.AI_USAGE_LIMIT_REACHED;
  }
  return AI_AGENT_SHADOW_ERROR_CODES.PROVIDER_UNAVAILABLE;
}

export function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error && err.message === "SHADOW_TIMEOUT") return true;
  const message = readErrorMessage(err);
  return message.includes("timeout") || message.includes("timed out");
}
