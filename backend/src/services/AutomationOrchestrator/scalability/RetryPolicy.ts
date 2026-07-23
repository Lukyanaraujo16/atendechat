import { AgentOsRetryClass } from "../../../config/automationAgentOsScalabilityConstants";
import { getScalabilityConfig } from "./ScalabilityConfig";

export function classifyAgentOsError(err: unknown): AgentOsRetryClass {
  const msg = err instanceof Error ? err.message : String(err);
  if (/ERR_.*(AUTH|PERMISSION|NO_PERMISSION|USER_FEATURE|PLAN_FEATURE)/i.test(msg))
    return "AUTHORIZATION";
  if (/ERR_.*(VALID|CONFIRM|TENANT_MISMATCH|PAYLOAD)/i.test(msg))
    return "VALIDATION";
  if (/ERR_.*(POLICY|BOUNDARY)/i.test(msg)) return "POLICY_BLOCKED";
  if (/ERR_.*RATE_LIMIT/i.test(msg)) return "RATE_LIMITED";
  if (/timeout|ETIMEDOUT|TIMEOUT/i.test(msg)) return "TIMEOUT";
  if (/AMBIGUOUS|ERR_AGENTOS_AMBIGUOUS/i.test(msg)) return "AMBIGUOUS";
  if (/ECONNREFUSED|ENOTFOUND|unavailable|DEPENDENCY/i.test(msg))
    return "DEPENDENCY_UNAVAILABLE";
  if (/NON_RETRYABLE|ERR_VALIDATION/i.test(msg)) return "NON_RETRYABLE";
  return "RETRYABLE";
}

export function isRetryable(cls: AgentOsRetryClass): boolean {
  return (
    cls === "RETRYABLE" ||
    cls === "TIMEOUT" ||
    cls === "DEPENDENCY_UNAVAILABLE" ||
    cls === "RATE_LIMITED"
  );
}

export function computeBackoffMs(attempt: number): number {
  const cfg = getScalabilityConfig().retry;
  const exp = Math.min(
    cfg.maxDelayMs,
    cfg.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1))
  );
  const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.2));
  return exp + jitter;
}
