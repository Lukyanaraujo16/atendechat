import {
  loadLiveRolloutConfig,
  saveLiveRolloutConfig
} from "./LiveRolloutConfigService";
import { recordLiveRollback } from "./LiveRolloutMetrics";
import { LiveRolloutStage } from "../../../config/automationLiveRolloutConstants";
import { getEvidenceMetricsSnapshot } from "../evidence/EvidenceMetrics";
import { getLiveRolloutMetricsSnapshot } from "./LiveRolloutMetrics";

/**
 * Auto Rollback — baixa percentual/stage com base em métricas.
 * Sem scheduler; invocável via API ou após execução.
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
  const next =
    steps.find(s => s < current) ??
    (current > 0 ? 0 : 0);

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
 * Avança um degrau do plano se progressive.enabled.
 */
export async function advanceProgressiveRolloutStep(input: {
  companyId: number;
}): Promise<{
  applied: boolean;
  percent: number;
  stage: LiveRolloutStage;
  reason: string;
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
  const plan = config.progressive.plan || [];
  const current = config.percent;
  const nextStep = plan.find(p => p.percent > current);
  if (!nextStep) {
    await saveLiveRolloutConfig(input.companyId, {
      percent: 100,
      stage: "FULL"
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
  return {
    applied: true,
    percent: nextStep.percent,
    stage,
    reason: `progressive_to_${nextStep.percent}`
  };
}

export default { evaluateAndApplyAutoRollback, advanceProgressiveRolloutStep };
