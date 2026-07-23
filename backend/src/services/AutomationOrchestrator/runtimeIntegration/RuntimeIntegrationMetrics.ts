import {
  RuntimeIntegrationEvent,
  RuntimeIntegrationRecord
} from "./types";

export type RuntimeIntegrationMetricsSnapshot = {
  requests: number;
  success: number;
  failure: number;
  timeouts: number;
  policyWarnings: number;
  averageLatency: number;
  averageCost: number;
  dispatcherUsage: Record<string, number>;
  adapterUsage: Record<string, number>;
};

const records: RuntimeIntegrationRecord[] = [];
const events: RuntimeIntegrationEvent[] = [];
const MAX = 500;

export function recordRuntimeIntegrationExecution(
  record: RuntimeIntegrationRecord
): void {
  records.push(record);
  if (records.length > MAX) records.shift();
  try {
    // Wave 3 observability side-effect only
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { observeAgentOsStep } = require("../observability/observeAgentOsStep");
    const duration = record.adapterResult?.durationMs || 0;
    const status = record.adapterResult?.status;
    observeAgentOsStep({
      companyId: record.companyId,
      origin: "runtime",
      type: "runtime.execution",
      latencyMs: duration,
      success: status === "success" || status === "waiting",
      timeout: status === "timeout",
      toolId: record.adapterResult?.toolId,
      finish: true
    });
  } catch {
    /* fail-open */
  }
}

export function recordRuntimeIntegrationEvent(
  event: RuntimeIntegrationEvent
): void {
  events.push(event);
  if (events.length > MAX) events.shift();
}

export function getRuntimeIntegrationMetrics(): RuntimeIntegrationMetricsSnapshot {
  const total = records.length;
  if (!total) {
    return {
      requests: 0,
      success: 0,
      failure: 0,
      timeouts: 0,
      policyWarnings: 0,
      averageLatency: 0,
      averageCost: 0,
      dispatcherUsage: {},
      adapterUsage: {}
    };
  }

  let success = 0;
  let failure = 0;
  let timeouts = 0;
  let policyWarnings = 0;
  let latencySum = 0;
  let costSum = 0;
  const dispatcherUsage: Record<string, number> = {};
  const adapterUsage: Record<string, number> = {};

  for (const r of records) {
    policyWarnings += r.policy.warnings.length;
    costSum += r.policy.costEstimate;
    dispatcherUsage[r.capability.kind] =
      (dispatcherUsage[r.capability.kind] || 0) + 1;
    if (r.adapterResult) {
      latencySum += r.adapterResult.durationMs;
      adapterUsage[r.adapterResult.adapter] =
        (adapterUsage[r.adapterResult.adapter] || 0) + 1;
      if (r.adapterResult.status === "success" || r.adapterResult.status === "waiting") {
        success += 1;
      } else if (r.adapterResult.status === "timeout") {
        timeouts += 1;
        failure += 1;
      } else {
        failure += 1;
      }
    } else {
      failure += 1;
    }
  }

  return {
    requests: total,
    success,
    failure,
    timeouts,
    policyWarnings,
    averageLatency: latencySum / total,
    averageCost: costSum / total,
    dispatcherUsage,
    adapterUsage
  };
}

export function listRuntimeIntegrationRecords(
  limit = 50
): RuntimeIntegrationRecord[] {
  return records.slice(-limit).reverse();
}

export function findRuntimeIntegrationRecord(
  id: string
): RuntimeIntegrationRecord | null {
  return records.find(r => r.id === id) || null;
}

export function __resetRuntimeIntegrationMetricsForTests(): void {
  records.length = 0;
  events.length = 0;
}

export default {
  getRuntimeIntegrationMetrics,
  listRuntimeIntegrationRecords,
  findRuntimeIntegrationRecord
};
