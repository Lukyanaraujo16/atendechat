import { EvidenceScoreRates } from "./EvidenceReadinessEngine";

export type EvidenceRecommendation = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  subject?: string;
};

/**
 * Recomendações determinísticas — sem IA.
 */
export function buildEvidenceRecommendations(input: {
  rates: EvidenceScoreRates;
  typeCounts: Record<string, number>;
  toolStats: Array<{
    toolId: string;
    usage: number;
    verified: number;
    empty: number;
    failures: number;
    neverUsed?: boolean;
  }>;
  providerStats: Array<{
    provider: string;
    samples: number;
    verificationRate: number;
    averageCost: number;
    averageLatency: number;
    hallucinationRate: number;
  }>;
}): EvidenceRecommendation[] {
  const out: EvidenceRecommendation[] = [];
  const { rates, typeCounts, toolStats, providerStats } = input;

  if (rates.hallucinationRate >= 0.1) {
    out.push({
      code: "HIGH_HALLUCINATION",
      severity: "critical",
      message: `Taxa de alucinação após Tool em ${(rates.hallucinationRate * 100).toFixed(1)}%.`
    });
  }

  if (rates.verificationRate < 0.4 && rates.sampleCount >= 5) {
    out.push({
      code: "LOW_VERIFICATION",
      severity: "warning",
      message: `Verification rate baixa (${(rates.verificationRate * 100).toFixed(1)}%).`
    });
  }

  if ((typeCounts.EMPTY_RESULT || 0) >= 3) {
    out.push({
      code: "MANY_EMPTY_RESULTS",
      severity: "warning",
      message: `EMPTY_RESULT frequente (${typeCounts.EMPTY_RESULT} ocorrências).`
    });
  }

  if ((typeCounts.KNOWLEDGE_UNUSED || 0) > (typeCounts.KNOWLEDGE_VERIFIED || 0)) {
    out.push({
      code: "KNOWLEDGE_UNDERUSED",
      severity: "info",
      message: "Knowledge recuperada é frequentemente ignorada na resposta."
    });
  }

  for (const t of toolStats) {
    if (t.neverUsed) {
      out.push({
        code: "TOOL_NEVER_USED",
        severity: "info",
        subject: t.toolId,
        message: `${t.toolId} nunca utilizado.`
      });
    }
    if (t.usage >= 3 && t.empty / t.usage >= 0.5) {
      out.push({
        code: "TOOL_MANY_EMPTY",
        severity: "warning",
        subject: t.toolId,
        message: `${t.toolId} gera muitos vazios (${t.empty}/${t.usage}).`
      });
    }
    if (t.usage >= 3 && t.verified / t.usage >= 0.7) {
      out.push({
        code: "TOOL_HIGH_SUCCESS",
        severity: "info",
        subject: t.toolId,
        message: `${t.toolId} possui alta taxa de verificação.`
      });
    }
  }

  if (providerStats.length >= 2) {
    const byCost = [...providerStats].sort(
      (a, b) => a.averageCost - b.averageCost
    );
    const cheapest = byCost[0];
    if (cheapest && cheapest.samples >= 2) {
      out.push({
        code: "PROVIDER_LOWER_COST",
        severity: "info",
        subject: cheapest.provider,
        message: `${cheapest.provider} apresenta menor custo médio (${cheapest.averageCost}).`
      });
    }
    const byVer = [...providerStats].sort(
      (a, b) => b.verificationRate - a.verificationRate
    );
    if (byVer[0] && byVer[0].samples >= 2) {
      out.push({
        code: "PROVIDER_BEST_VERIFICATION",
        severity: "info",
        subject: byVer[0].provider,
        message: `${byVer[0].provider} apresenta melhor verification rate.`
      });
    }
  }

  if (rates.toolDeniedRate >= 0.2) {
    out.push({
      code: "HIGH_DENIALS",
      severity: "warning",
      message: `Taxa de negações elevada (${(rates.toolDeniedRate * 100).toFixed(1)}%).`
    });
  }

  if (rates.loopStopRate >= 0.15) {
    out.push({
      code: "MANY_LOOP_STOPS",
      severity: "warning",
      message: `Loops interrompidos em ${(rates.loopStopRate * 100).toFixed(1)}% das execuções.`
    });
  }

  return out.slice(0, 40);
}

export default { buildEvidenceRecommendations };
