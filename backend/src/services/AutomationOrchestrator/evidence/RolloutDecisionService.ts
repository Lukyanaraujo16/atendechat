import {
  EvidenceThresholdsConfig,
  ReadinessLevel
} from "../../../config/automationEvidenceConstants";
import { EvidenceScoreRates } from "./EvidenceReadinessEngine";

export type RolloutDecision = {
  /** Sempre false nesta fase — infraestrutura apenas. */
  liveFunctionCallingEnabled: false;
  companyApt: boolean;
  connectionApt: boolean | null;
  agentApt: boolean | null;
  providerApt: boolean | null;
  readinessLevel: ReadinessLevel;
  readinessScore: number;
  reasons: string[];
  blockers: string[];
};

/**
 * RolloutDecisionService — responde aptidão.
 * NÃO habilita Live. NÃO altera comportamento.
 */
export function decideRolloutAptitude(input: {
  companyId: number;
  rates: EvidenceScoreRates;
  readiness: {
    score: number;
    level: ReadinessLevel;
    reasons: string[];
  };
  thresholds: EvidenceThresholdsConfig;
  connectionRates?: EvidenceScoreRates | null;
  agentRates?: EvidenceScoreRates | null;
  provider?: string | null;
  providerRates?: {
    verificationRate: number;
    hallucinationRate: number;
    samples: number;
  } | null;
}): RolloutDecision {
  const blockers: string[] = [];
  const reasons = [...(input.readiness.reasons || [])];

  reasons.push("Live Function Calling só via Rollout Stages + Eligibility (sem botão global).");
  reasons.push("Write Tools no Live permanecem desabilitadas por padrão.");

  if (input.rates.sampleCount < input.thresholds.minSamples) {
    blockers.push("insufficient_samples");
  }
  if (
    input.readiness.level === "NOT_READY" ||
    input.readiness.level === "EXPERIMENTAL"
  ) {
    blockers.push(`readiness_${input.readiness.level.toLowerCase()}`);
  }
  if (input.rates.hallucinationRate > 0.15) {
    blockers.push("hallucination_rate_high");
  }

  const companyApt =
    blockers.length === 0 &&
    (input.readiness.level === "READY" ||
      input.readiness.level === "PRODUCTION" ||
      input.readiness.level === "LIMITED");

  let connectionApt: boolean | null = null;
  if (input.connectionRates) {
    connectionApt =
      input.connectionRates.sampleCount >= 3 &&
      input.connectionRates.hallucinationRate <= 0.15 &&
      input.connectionRates.verificationRate >= 0.4;
    if (!connectionApt) blockers.push("connection_not_apt");
  }

  let agentApt: boolean | null = null;
  if (input.agentRates) {
    agentApt =
      input.agentRates.sampleCount >= 3 &&
      input.agentRates.hallucinationRate <= 0.15;
    if (!agentApt) blockers.push("agent_not_apt");
  }

  let providerApt: boolean | null = null;
  if (input.provider === "claude") {
    providerApt = false;
    blockers.push("provider_claude_not_implemented");
  } else if (input.providerRates) {
    providerApt =
      input.providerRates.samples >= 3 &&
      input.providerRates.hallucinationRate <= 0.15;
    if (!providerApt) blockers.push("provider_not_apt");
  }

  return {
    liveFunctionCallingEnabled: false,
    companyApt,
    connectionApt,
    agentApt,
    providerApt,
    readinessLevel: input.readiness.level,
    readinessScore: input.readiness.score,
    reasons,
    blockers: [...new Set(blockers)]
  };
}

export default { decideRolloutAptitude };
