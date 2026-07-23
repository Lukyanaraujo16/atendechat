import { ActionType } from "../../../../config/automationActionExecutionConstants";
import { ActionExecutionResult } from "./actionTypes";

export type ActionExecutionMetricsSnapshot = {
  actionsExecuted: number;
  successRate: number;
  failureRate: number;
  waitingRate: number;
  averageDuration: number;
  strategyUsage: Record<string, number>;
  validationRate: Record<string, number>;
};

const results: ActionExecutionResult[] = [];
const MAX_RESULTS = 500;

export function recordActionExecutionResult(result: ActionExecutionResult): void {
  results.push(result);
  if (results.length > MAX_RESULTS) {
    results.splice(0, results.length - MAX_RESULTS);
  }
}

export function getActionExecutionMetrics(): ActionExecutionMetricsSnapshot {
  const total = results.length;
  if (!total) {
    return {
      actionsExecuted: 0,
      successRate: 0,
      failureRate: 0,
      waitingRate: 0,
      averageDuration: 0,
      strategyUsage: {},
      validationRate: {}
    };
  }

  let success = 0;
  let failed = 0;
  let waiting = 0;
  let durationSum = 0;
  const strategyUsage: Record<string, number> = {};
  const validationRate: Record<string, number> = {};

  for (const r of results) {
    durationSum += r.duration;
    strategyUsage[r.strategy] = (strategyUsage[r.strategy] || 0) + 1;
    validationRate[r.validation] = (validationRate[r.validation] || 0) + 1;
    if (r.status === "SUCCESS") success += 1;
    else if (r.status === "FAILED" || r.status === "ABORTED") failed += 1;
    else if (r.status === "WAITING") waiting += 1;
  }

  return {
    actionsExecuted: total,
    successRate: success / total,
    failureRate: failed / total,
    waitingRate: waiting / total,
    averageDuration: durationSum / total,
    strategyUsage,
    validationRate
  };
}

export function listActionExecutionResults(limit = 50): ActionExecutionResult[] {
  return results.slice(-limit).reverse();
}

export function findActionExecutionResult(
  id: string
): ActionExecutionResult | null {
  return results.find(r => r.actionId === id) || null;
}

export function __resetActionExecutionMetricsForTests(): void {
  results.length = 0;
}

export default {
  recordActionExecutionResult,
  getActionExecutionMetrics,
  listActionExecutionResults,
  findActionExecutionResult
};
