import {
  loadLiveRolloutConfig,
  saveLiveRolloutConfig
} from "./LiveRolloutConfigService";
import { recordLiveRollback } from "./LiveRolloutMetrics";
import { LiveRolloutStage } from "../../../config/automationLiveRolloutConstants";
import { getEvidenceMetricsSnapshot } from "../evidence/EvidenceMetrics";
import { getLiveRolloutMetricsSnapshot } from "./LiveRolloutMetrics";
import {
  canApplyRollback,
  canPromoteRollout,
  markPromotionApplied,
  markRollbackApplied
} from "./hardening/RolloutGuards";
import { recordDistributedMetric } from "./hardening/DistributedMetricsStore";
import { emitProductionAlert } from "./hardening/ProductionAlerts";

/**
 * Auto Rollback — baixa percentual/stage com base em métricas.
 * Sem scheduler; invocável via API ou após execução.
 * Rollback Guard impede oscilação promoção↔rollback.
 */
export async function evaluateAndApplyAutoRollback(input: {
  companyId: number;
}): Promise<{
  applied: boolean;
  previousPercent: number;
  nextPercent: number;
  previousStage: LiveRolloutStage;
  nextStage: LiveRolloutStage;
  reasons: string[];
}> {
  const config = await loadLiveRolloutConfig(input.companyId);
  const reasons: string[] = [];

  if (!config.autoRollback.enabled) {
    return {
      applied: false,
      previousPercent: config.percent,
      nextPercent: config.percent,
      previousStage: config.stage,
      nextStage: config.stage,
      reasons: ["auto_rollback_disabled"]
    };
  }

  const guard = await canApplyRollback(input.companyId);
  if (!guard.allowed) {
    return {
      applied: false,
      previousPercent: config.percent,
      nextPercent: config.percent,
      previousStage: config.stage,
      nextStage: config.stage,
      reasons: [guard.reason]
    };
  }

  const evidence = getEvidenceMetricsSnapshot(input.companyId);
  const live = getLiveRolloutMetricsSnapshot(input.companyId);

  if (evidence.sampleCount + live.liveExecutions < 5) {
    return {
      applied: false,
      previousPercent: config.percent,
      nextPercent: config.percent,
      previousStage: config.stage,
      nextStage: config.stage,
      reasons: ["insufficient_samples"]
    };
  }

  if (evidence.hallucinationRate > config.autoRollback.maxHallucinationRate) {
    reasons.push("hallucination_high");
  }
  const failureRate = live.toolCalls
    ? live.toolFailures / live.toolCalls
    : evidence.toolFailureRate;
  if (failureRate > config.autoRollback.maxToolFailureRate) {
    reasons.push("tool_failure_high");
  }
  if (
    (live.averageLatency || evidence.averageLatency) >
    config.autoRollback.maxLatencyMs
  ) {
    reasons.push("latency_high");
  }

  if (!reasons.length) {
    return {
      applied: false,
      previousPercent: config.percent,
      nextPercent: config.percent,
      previousStage: config.stage,
      nextStage: config.stage,
      reasons: ["thresholds_ok"]
    };
  }

  const steps = [...(config.autoRollback.steps || [50, 25, 10, 5, 0])].sort(
    (a, b) => b - a
  );
  const current = config.stage === "FULL" ? 100 : config.percent;
  const next = steps.find(s => s < current) ?? (current > 0 ? 0 : 0);

  let nextStage: LiveRolloutStage = config.stage;
  if (next <= 0) {
    nextStage = "SHADOW";
  } else if (next < 100 && config.stage === "FULL") {
    nextStage = "PARTIAL";
  } else if (next <= 10) {
    nextStage = "CANARY";
  }

  await saveLiveRolloutConfig(input.companyId, {
    percent: next,
    stage: nextStage
  });
  recordLiveRollback(input.companyId);
  await markRollbackApplied(input.companyId);
  void recordDistributedMetric({
    companyId: input.companyId,
    field: "rollbacks"
  });
  emitProductionAlert({
    companyId: input.companyId,
    kind: "rollback",
    message: `Auto rollback ${current}% → ${next}% (${reasons.join(",")})`,
    meta: { previousPercent: current, nextPercent: next, reasons }
  });

  return {
    applied: true,
    previousPercent: current,
    nextPercent: next,
    previousStage: config.stage,
    nextStage,
    reasons
  };
}

/**
 * Progressive rollout step — infraestrutura apenas (sem scheduler).
 * Promotion Guard exige amostras mínimas antes de avançar.
 */
export async function advanceProgressiveRolloutStep(input: {
  companyId: number;
}): Promise<{
  applied: boolean;
  percent: number;
  stage: LiveRolloutStage;
  reason: string;
  blockers?: string[];
}> {
  const config = await loadLiveRolloutConfig(input.companyId);
  if (!config.progressive.enabled) {
    return {
      applied: false,
      percent: config.percent,
      stage: config.stage,
      reason: "progressive_disabled"
    };
  }

  const promo = await canPromoteRollout(input.companyId);
  if (!promo.allowed) {
    return {
      applied: false,
      percent: config.percent,
      stage: config.stage,
      reason: "promotion_guard_blocked",
      blockers: promo.blockers
    };
  }

  const plan = config.progressive.plan || [];
  const current = config.percent;
  const nextStep = plan.find(p => p.percent > current);
  if (!nextStep) {
    await saveLiveRolloutConfig(input.companyId, {
      percent: 100,
      stage: "FULL"
    });
    await markPromotionApplied(input.companyId);
    void recordDistributedMetric({
      companyId: input.companyId,
      field: "rollouts"
    });
    return {
      applied: true,
      percent: 100,
      stage: "FULL",
      reason: "progressive_complete"
    };
  }
  const stage: LiveRolloutStage =
    nextStep.percent >= 100
      ? "FULL"
      : nextStep.percent <= 10
        ? "CANARY"
        : "PARTIAL";
  await saveLiveRolloutConfig(input.companyId, {
    percent: nextStep.percent,
    stage
  });
  await markPromotionApplied(input.companyId);
  void recordDistributedMetric({
    companyId: input.companyId,
    field: "rollouts"
  });
  return {
    applied: true,
    percent: nextStep.percent,
    stage,
    reason: `progressive_to_${nextStep.percent}`
  };
}

export default { evaluateAndApplyAutoRollback, advanceProgressiveRolloutStep };
