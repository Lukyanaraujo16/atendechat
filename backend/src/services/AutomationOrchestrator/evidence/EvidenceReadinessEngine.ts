import Setting from "../../../models/Setting";
import {
  DEFAULT_EVIDENCE_THRESHOLDS,
  EVIDENCE_COMPANY_THRESHOLDS_SETTING_KEY,
  EvidenceThresholdsConfig,
  ReadinessLevel
} from "../../../config/automationEvidenceConstants";

export type EvidenceScoreRates = {
  verificationRate: number;
  toolUtilizationRate: number;
  hallucinationRate: number;
  knowledgeUtilizationRate: number;
  selectionAccuracy: number;
  averageToolCalls: number;
  averageLatency: number;
  averageCost: number;
  averageTokens: number;
  toolFailureRate: number;
  toolDeniedRate: number;
  loopStopRate: number;
  sampleCount: number;
};

export async function loadEvidenceThresholds(
  companyId: number
): Promise<EvidenceThresholdsConfig> {
  const row = await Setting.findOne({
    where: {
      companyId,
      key: EVIDENCE_COMPANY_THRESHOLDS_SETTING_KEY
    }
  });
  if (!row?.value) {
    return JSON.parse(JSON.stringify(DEFAULT_EVIDENCE_THRESHOLDS));
  }
  try {
    const parsed = JSON.parse(row.value);
    return mergeThresholds(parsed);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_EVIDENCE_THRESHOLDS));
  }
}

export async function saveEvidenceThresholds(
  companyId: number,
  thresholds: Partial<EvidenceThresholdsConfig>
): Promise<EvidenceThresholdsConfig> {
  const merged = mergeThresholds(thresholds);
  const value = JSON.stringify(merged);
  const [row] = await Setting.findOrCreate({
    where: {
      companyId,
      key: EVIDENCE_COMPANY_THRESHOLDS_SETTING_KEY
    },
    defaults: {
      companyId,
      key: EVIDENCE_COMPANY_THRESHOLDS_SETTING_KEY,
      value
    }
  });
  await row.update({ value });
  return merged;
}

function mergeThresholds(
  partial: Partial<EvidenceThresholdsConfig> | Record<string, unknown>
): EvidenceThresholdsConfig {
  const base: EvidenceThresholdsConfig = JSON.parse(
    JSON.stringify(DEFAULT_EVIDENCE_THRESHOLDS)
  );
  const p = partial as EvidenceThresholdsConfig;
  if (p.weights) base.weights = { ...base.weights, ...p.weights };
  if (p.norms) base.norms = { ...base.norms, ...p.norms };
  if (p.levels) {
    base.levels = {
      NOT_READY: { ...base.levels.NOT_READY, ...(p.levels.NOT_READY || {}) },
      EXPERIMENTAL: {
        ...base.levels.EXPERIMENTAL,
        ...(p.levels.EXPERIMENTAL || {})
      },
      LIMITED: { ...base.levels.LIMITED, ...(p.levels.LIMITED || {}) },
      READY: { ...base.levels.READY, ...(p.levels.READY || {}) },
      PRODUCTION: {
        ...base.levels.PRODUCTION,
        ...(p.levels.PRODUCTION || {})
      }
    };
  }
  if (typeof p.minSamples === "number") base.minSamples = p.minSamples;
  return normalizeWeights(base);
}

function normalizeWeights(
  cfg: EvidenceThresholdsConfig
): EvidenceThresholdsConfig {
  const w = cfg.weights;
  const sum =
    w.verificationRate +
    w.hallucinationRate +
    w.toolFailureRate +
    w.toolDeniedRate +
    w.loopStopRate +
    w.knowledgeUtilizationRate +
    w.latencyNorm +
    w.costNorm;
  if (sum <= 0) return cfg;
  const scale = 1 / sum;
  return {
    ...cfg,
    weights: {
      verificationRate: w.verificationRate * scale,
      hallucinationRate: w.hallucinationRate * scale,
      toolFailureRate: w.toolFailureRate * scale,
      toolDeniedRate: w.toolDeniedRate * scale,
      loopStopRate: w.loopStopRate * scale,
      knowledgeUtilizationRate: w.knowledgeUtilizationRate * scale,
      latencyNorm: w.latencyNorm * scale,
      costNorm: w.costNorm * scale
    }
  };
}

/**
 * Readiness Score usando pesos da config (não hardcoded no cálculo).
 * Fatores "ruins" entram como (1 - rate).
 */
export function computeReadinessScore(
  rates: EvidenceScoreRates,
  thresholds: EvidenceThresholdsConfig
): { score: number; level: ReadinessLevel; reasons: string[] } {
  const reasons: string[] = [];
  if (rates.sampleCount < thresholds.minSamples) {
    reasons.push(
      `Amostras insuficientes (${rates.sampleCount} < ${thresholds.minSamples}).`
    );
  }

  const w = thresholds.weights;
  const latencyFactor = clamp01(
    1 - rates.averageLatency / Math.max(1, thresholds.norms.maxLatencyMs)
  );
  const costFactor = clamp01(
    1 - rates.averageCost / Math.max(1e-9, thresholds.norms.maxAverageCostUsd)
  );

  const score = clamp01(
    w.verificationRate * rates.verificationRate +
      w.hallucinationRate * (1 - rates.hallucinationRate) +
      w.toolFailureRate * (1 - rates.toolFailureRate) +
      w.toolDeniedRate * (1 - rates.toolDeniedRate) +
      w.loopStopRate * (1 - rates.loopStopRate) +
      w.knowledgeUtilizationRate * rates.knowledgeUtilizationRate +
      w.latencyNorm * latencyFactor +
      w.costNorm * costFactor
  );

  const level = resolveLevel(score, rates, thresholds, reasons);
  return { score: Number(score.toFixed(4)), level, reasons };
}

function resolveLevel(
  score: number,
  rates: EvidenceScoreRates,
  thresholds: EvidenceThresholdsConfig,
  reasons: string[]
): ReadinessLevel {
  const prod = thresholds.levels.PRODUCTION;
  if (
    score >= prod.minScore &&
    rates.sampleCount >= thresholds.minSamples &&
    (prod.minVerificationRate == null ||
      rates.verificationRate >= prod.minVerificationRate) &&
    (prod.maxHallucinationRate == null ||
      rates.hallucinationRate <= prod.maxHallucinationRate) &&
    (prod.maxToolFailureRate == null ||
      rates.toolFailureRate <= prod.maxToolFailureRate) &&
    (prod.maxLoopStopRate == null ||
      rates.loopStopRate <= prod.maxLoopStopRate)
  ) {
    return "PRODUCTION";
  }
  if (score >= prod.minScore && rates.sampleCount >= thresholds.minSamples) {
    reasons.push("Score alto, mas thresholds de PRODUCTION não satisfeitos.");
  }

  const ready = thresholds.levels.READY;
  if (
    score >= ready.minScore &&
    score <= ready.maxScore &&
    rates.sampleCount >= thresholds.minSamples &&
    (ready.minVerificationRate == null ||
      rates.verificationRate >= ready.minVerificationRate) &&
    (ready.maxHallucinationRate == null ||
      rates.hallucinationRate <= ready.maxHallucinationRate)
  ) {
    return "READY";
  }
  // Score no range READY mas thresholds falharam → LIMITED
  if (score >= ready.minScore && rates.sampleCount >= thresholds.minSamples) {
    return "LIMITED";
  }

  const limited = thresholds.levels.LIMITED;
  if (score >= limited.minScore && score <= limited.maxScore) {
    return "LIMITED";
  }

  const exp = thresholds.levels.EXPERIMENTAL;
  if (score >= exp.minScore && score <= exp.maxScore) {
    return "EXPERIMENTAL";
  }

  return "NOT_READY";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export default {
  loadEvidenceThresholds,
  saveEvidenceThresholds,
  computeReadinessScore
};
