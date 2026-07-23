import { ExecutionSession } from "./executionTypes";

type Metrics = {
  sessionsCreated: number;
  sessionsCompleted: number;
  sessionsFailed: number;
  durationSum: number;
  stepsSum: number;
  retriesSum: number;
  waiting: number;
  pauses: number;
  recoveries: number;
};

const store = new Map<number, Metrics>();

function empty(): Metrics {
  return {
    sessionsCreated: 0,
    sessionsCompleted: 0,
    sessionsFailed: 0,
    durationSum: 0,
    stepsSum: 0,
    retriesSum: 0,
    waiting: 0,
    pauses: 0,
    recoveries: 0
  };
}

function get(companyId: number): Metrics {
  let m = store.get(companyId);
  if (!m) {
    m = empty();
    store.set(companyId, m);
  }
  return m;
}

export function recordSessionCreated(companyId: number): void {
  get(companyId).sessionsCreated += 1;
}

export function recordSessionCompleted(
  companyId: number,
  session: ExecutionSession
): void {
  const m = get(companyId);
  m.sessionsCompleted += 1;
  m.durationSum += session.metrics.durationMs;
  m.stepsSum += session.metrics.stepsCompleted;
  m.retriesSum += session.metrics.retries;
}

export function recordSessionFailed(
  companyId: number,
  _reason?: string
): void {
  get(companyId).sessionsFailed += 1;
}

export function recordSessionMetricBump(
  companyId: number,
  kind: "waiting" | "pause" | "recovery"
): void {
  const m = get(companyId);
  if (kind === "waiting") m.waiting += 1;
  if (kind === "pause") m.pauses += 1;
  if (kind === "recovery") m.recoveries += 1;
}

export function getExecutionOrchestratorMetrics(companyId: number) {
  const m = get(companyId);
  const n = m.sessionsCreated || 0;
  const done = m.sessionsCompleted || 0;
  return {
    sessionsCreated: n,
    sessionsCompleted: done,
    sessionsFailed: m.sessionsFailed,
    averageDuration: done ? Math.round(m.durationSum / done) : 0,
    averageSteps: done ? Number((m.stepsSum / done).toFixed(2)) : 0,
    averageRetries: done ? Number((m.retriesSum / done).toFixed(2)) : 0,
    waitingRate: n ? Number((m.waiting / n).toFixed(3)) : 0,
    pauseRate: n ? Number((m.pauses / n).toFixed(3)) : 0,
    recoveryRate: n ? Number((m.recoveries / n).toFixed(3)) : 0
  };
}

export function __resetExecutionOrchestratorMetricsForTests(): void {
  store.clear();
}

export default {
  recordSessionCreated,
  getExecutionOrchestratorMetrics
};
