import { CostLimitState } from "../../../config/automationAgentOsProductionConstants";
import { loadRolloutConfig } from "./RolloutStateMachine";

type CostBucket = {
  daily: number;
  monthly: number;
  updatedAt: string;
};

const spend = new Map<number, CostBucket>();

export async function evaluateCostLimit(companyId: number): Promise<{
  state: CostLimitState;
  daily: number;
  monthly: number;
  maxDailyCost: number | null;
  softLimitRatio: number;
}> {
  const cfg = await loadRolloutConfig(companyId);
  const bucket = spend.get(companyId) || {
    daily: 0,
    monthly: 0,
    updatedAt: new Date().toISOString()
  };
  const max = cfg.maxDailyCost;
  if (max == null) {
    return {
      state: "UNKNOWN",
      daily: bucket.daily,
      monthly: bucket.monthly,
      maxDailyCost: null,
      softLimitRatio: 0.8
    };
  }
  if (bucket.daily >= max) {
    return {
      state: "HARD_LIMIT",
      daily: bucket.daily,
      monthly: bucket.monthly,
      maxDailyCost: max,
      softLimitRatio: 0.8
    };
  }
  if (bucket.daily >= max * 0.8) {
    return {
      state: "SOFT_LIMIT",
      daily: bucket.daily,
      monthly: bucket.monthly,
      maxDailyCost: max,
      softLimitRatio: 0.8
    };
  }
  return {
    state: "WITHIN_LIMIT",
    daily: bucket.daily,
    monthly: bucket.monthly,
    maxDailyCost: max,
    softLimitRatio: 0.8
  };
}

/** Registra custo estimado quando metadata disponível — nunca inventa preço. */
export function recordEstimatedCost(
  companyId: number,
  amount: number | null | undefined
): void {
  if (amount == null || Number.isNaN(amount) || amount < 0) return;
  const bucket = spend.get(companyId) || {
    daily: 0,
    monthly: 0,
    updatedAt: new Date().toISOString()
  };
  bucket.daily += amount;
  bucket.monthly += amount;
  bucket.updatedAt = new Date().toISOString();
  spend.set(companyId, bucket);
}

export function resetCostControlsForTests(): void {
  spend.clear();
}
