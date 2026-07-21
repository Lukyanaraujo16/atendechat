import { AUTOMATION_TOOL_CIRCUIT_BREAKER } from "../../../config/automationToolConstants";
import { logger } from "../../../utils/logger";

type FailureKind =
  | "failure"
  | "timeout"
  | "rollback_failure"
  | "dependency"
  | string;

type ToolBreakerState = {
  failures: Array<{ at: number; kind: FailureKind }>;
  openUntil: number | null;
  tripReason: string | null;
};

const stateByKey = new Map<string, ToolBreakerState>();

function keyOf(companyId: number, toolId: string, toolVersion: string): string {
  return `${companyId}:${toolId}@${toolVersion}`;
}

function getState(
  companyId: number,
  toolId: string,
  toolVersion: string
): ToolBreakerState {
  const key = keyOf(companyId, toolId, toolVersion);
  let state = stateByKey.get(key);
  if (!state) {
    state = { failures: [], openUntil: null, tripReason: null };
    stateByKey.set(key, state);
  }
  return state;
}

function prune(now: number, items: Array<{ at: number }>): void {
  const cutoff = now - AUTOMATION_TOOL_CIRCUIT_BREAKER.failureWindowMs;
  while (items.length > 0 && items[0].at < cutoff) items.shift();
}

export function recordToolFailure(
  companyId: number,
  toolId: string,
  toolVersion: string,
  kind: FailureKind = "failure"
): void {
  const now = Date.now();
  const state = getState(companyId, toolId, toolVersion);
  prune(now, state.failures);
  state.failures.push({ at: now, kind });

  const timeouts = state.failures.filter(f => f.kind === "timeout").length;
  const rollbacks = state.failures.filter(f => f.kind === "rollback_failure")
    .length;

  if (state.failures.length >= AUTOMATION_TOOL_CIRCUIT_BREAKER.maxFailures) {
    tripToolCircuit(companyId, toolId, toolVersion, `max_failures:${state.failures.length}`);
  } else if (timeouts >= AUTOMATION_TOOL_CIRCUIT_BREAKER.maxTimeouts) {
    tripToolCircuit(companyId, toolId, toolVersion, `max_timeouts:${timeouts}`);
  } else if (
    rollbacks >= AUTOMATION_TOOL_CIRCUIT_BREAKER.maxRollbackFailures
  ) {
    tripToolCircuit(
      companyId,
      toolId,
      toolVersion,
      `max_rollback_failures:${rollbacks}`
    );
  }
}

export function recordToolSuccess(
  companyId: number,
  toolId: string,
  toolVersion: string
): void {
  const state = getState(companyId, toolId, toolVersion);
  prune(Date.now(), state.failures);
}

export function isToolCircuitOpen(
  companyId: number,
  toolId: string,
  toolVersion: string
): boolean {
  const now = Date.now();
  const state = getState(companyId, toolId, toolVersion);
  if (state.openUntil != null && state.openUntil > now) return true;
  if (state.openUntil != null && state.openUntil <= now) {
    state.openUntil = null;
    state.tripReason = null;
  }
  return false;
}

export function tripToolCircuit(
  companyId: number,
  toolId: string,
  toolVersion: string,
  reason: string
): void {
  const state = getState(companyId, toolId, toolVersion);
  state.openUntil =
    Date.now() + AUTOMATION_TOOL_CIRCUIT_BREAKER.openTtlSeconds * 1000;
  state.tripReason = reason;
  logger.warn(
    { companyId, toolId, toolVersion, reason },
    "[AutomationTools] circuit open"
  );
}

export function getToolCircuitSnapshot(
  companyId: number,
  toolId: string,
  toolVersion: string
): { open: boolean; tripReason: string | null; openUntil: number | null } {
  const state = getState(companyId, toolId, toolVersion);
  return {
    open: isToolCircuitOpen(companyId, toolId, toolVersion),
    tripReason: state.tripReason,
    openUntil: state.openUntil
  };
}

export function __resetToolCircuitBreakerForTests(): void {
  stateByKey.clear();
}
