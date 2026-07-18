import { AUTOMATION_CIRCUIT_BREAKER } from "../../../config/automationOrchestratorConstants";
import { logger } from "../../../utils/logger";

type FailureKind = "timeout" | "failure" | "critical_divergence" | string;

type CompanyBreakerState = {
  failures: Array<{ at: number; kind: FailureKind }>;
  criticalDivergences: Array<{ at: number }>;
  openUntil: number | null;
  tripReason: string | null;
};

const stateByCompany = new Map<number, CompanyBreakerState>();

function getState(companyId: number): CompanyBreakerState {
  let state = stateByCompany.get(companyId);
  if (!state) {
    state = {
      failures: [],
      criticalDivergences: [],
      openUntil: null,
      tripReason: null
    };
    stateByCompany.set(companyId, state);
  }
  return state;
}

function pruneWindow(now: number, items: Array<{ at: number }>): void {
  const cutoff = now - AUTOMATION_CIRCUIT_BREAKER.failureWindowMs;
  while (items.length > 0 && items[0].at < cutoff) {
    items.shift();
  }
}

export function recordFailure(companyId: number, kind: FailureKind = "failure"): void {
  const now = Date.now();
  const state = getState(companyId);
  pruneWindow(now, state.failures);
  state.failures.push({ at: now, kind });

  if (state.failures.length >= AUTOMATION_CIRCUIT_BREAKER.maxFailures) {
    tripCircuit(companyId, `max_failures:${state.failures.length}`);
  }
}

export function recordCriticalDivergence(companyId: number): void {
  const now = Date.now();
  const state = getState(companyId);
  pruneWindow(now, state.criticalDivergences);
  state.criticalDivergences.push({ at: now });
  recordFailure(companyId, "critical_divergence");

  if (
    state.criticalDivergences.length >=
    AUTOMATION_CIRCUIT_BREAKER.maxCriticalDivergences
  ) {
    tripCircuit(
      companyId,
      `max_critical_divergences:${state.criticalDivergences.length}`
    );
  }
}

export function recordSuccess(companyId: number): void {
  const state = getState(companyId);
  // Sucesso não fecha o circuit antecipadamente; só limpa contadores da janela.
  const now = Date.now();
  pruneWindow(now, state.failures);
  pruneWindow(now, state.criticalDivergences);
}

export type CircuitSettingsLike = {
  circuitBreakerOpenUntil?: Date | string | null;
};

export function isCircuitOpen(
  companyId: number,
  settings?: CircuitSettingsLike | null
): boolean {
  const now = Date.now();
  const state = getState(companyId);

  if (state.openUntil != null && state.openUntil > now) {
    return true;
  }
  if (state.openUntil != null && state.openUntil <= now) {
    state.openUntil = null;
    state.tripReason = null;
  }

  if (settings?.circuitBreakerOpenUntil) {
    const until = new Date(settings.circuitBreakerOpenUntil).getTime();
    if (Number.isFinite(until) && until > now) {
      return true;
    }
  }

  return false;
}

export function tripCircuit(companyId: number, reason: string): void {
  const state = getState(companyId);
  const openUntil =
    Date.now() + AUTOMATION_CIRCUIT_BREAKER.openTtlSeconds * 1000;
  state.openUntil = openUntil;
  state.tripReason = reason;

  void persistTripFailOpen(companyId, openUntil, reason);
}

async function persistTripFailOpen(
  companyId: number,
  openUntil: number,
  reason: string
): Promise<void> {
  try {
    // Lazy import para não acoplar testes a database/index.
    const AutomationOrchestratorSettings = (
      await import("../../../models/AutomationOrchestratorSettings")
    ).default;
    await AutomationOrchestratorSettings.update(
      {
        circuitBreakerOpenUntil: new Date(openUntil),
        metadata: { circuitTripReason: reason, trippedAt: new Date().toISOString() }
      },
      { where: { companyId, whatsappId: null, aiAgentId: null } }
    );
  } catch (err) {
    logger.warn(
      { err, companyId, reason },
      "[AutomationOrchestrator] tripCircuit persist fail-open"
    );
  }
}

/** Wrappers fail-open para uso em hooks de produção. */
export function safeRecordFailure(
  companyId: number,
  kind: FailureKind = "failure"
): void {
  try {
    recordFailure(companyId, kind);
  } catch (err) {
    logger.warn(
      { err, companyId, kind },
      "[AutomationOrchestrator] safeRecordFailure fail-open"
    );
  }
}

export function safeRecordCriticalDivergence(companyId: number): void {
  try {
    recordCriticalDivergence(companyId);
  } catch (err) {
    logger.warn(
      { err, companyId },
      "[AutomationOrchestrator] safeRecordCriticalDivergence fail-open"
    );
  }
}

export function safeRecordSuccess(companyId: number): void {
  try {
    recordSuccess(companyId);
  } catch (err) {
    logger.warn(
      { err, companyId },
      "[AutomationOrchestrator] safeRecordSuccess fail-open"
    );
  }
}

export function safeIsCircuitOpen(
  companyId: number,
  settings?: CircuitSettingsLike | null
): boolean {
  try {
    return isCircuitOpen(companyId, settings);
  } catch (err) {
    logger.warn(
      { err, companyId },
      "[AutomationOrchestrator] safeIsCircuitOpen fail-open → false"
    );
    return false;
  }
}

/** Test helper — limpa estado in-memory. */
export function __resetCircuitBreakerForTests(): void {
  stateByCompany.clear();
}

export default {
  recordFailure,
  recordCriticalDivergence,
  recordSuccess,
  isCircuitOpen,
  tripCircuit,
  safeRecordFailure,
  safeRecordCriticalDivergence,
  safeRecordSuccess,
  safeIsCircuitOpen
};
