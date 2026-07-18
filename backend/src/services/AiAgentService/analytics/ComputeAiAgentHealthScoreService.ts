import { AI_AGENT_HEALTH_SCORE_WEIGHTS } from "../../../config/aiAgentAnalyticsConstants";

export type HealthScoreInputs = {
  missRate: number;
  handoffRate: number;
  failureRate: number;
  avgRetrievalMs: number | null;
  hasIndexedDocuments: boolean;
};

export type HealthScoreResult = {
  score: number;
  formula: string;
  weights: typeof AI_AGENT_HEALTH_SCORE_WEIGHTS;
  components: {
    missPenalty: number;
    handoffPenalty: number;
    failurePenalty: number;
    latencyPenalty: number;
    coveragePenalty: number;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}

/**
 * score = clamp(100 - miss*W_MISS - handoff*W_HANDOFF - failure*W_FAILURE
 *               - latencyPenalty - coveragePenalty, 0, 100)
 */
export function computeAiAgentHealthScore(
  input: HealthScoreInputs
): HealthScoreResult {
  const W = AI_AGENT_HEALTH_SCORE_WEIGHTS;
  const missRate = clampRate(input.missRate);
  const handoffRate = clampRate(input.handoffRate);
  const failureRate = clampRate(input.failureRate);

  const missPenalty = missRate * W.W_MISS;
  const handoffPenalty = handoffRate * W.W_HANDOFF;
  const failurePenalty = failureRate * W.W_FAILURE;

  const avgRetrievalMs =
    input.avgRetrievalMs != null && Number.isFinite(input.avgRetrievalMs)
      ? Math.max(0, Number(input.avgRetrievalMs))
      : 0;
  const latencyPenalty = clamp(
    (avgRetrievalMs / W.LATENCY_REF_MS) * W.W_LATENCY,
    0,
    W.W_LATENCY
  );
  const coveragePenalty = input.hasIndexedDocuments ? 0 : W.W_COVERAGE;

  const raw =
    100 -
    missPenalty -
    handoffPenalty -
    failurePenalty -
    latencyPenalty -
    coveragePenalty;
  const score = Math.round(clamp(raw, 0, 100) * 10) / 10;

  return {
    score,
    formula:
      "clamp(100 - missRate*W_MISS - handoffRate*W_HANDOFF - failureRate*W_FAILURE - latencyPenalty - coveragePenalty, 0, 100); latencyPenalty=min(W_LATENCY, avgRetrievalMs/LATENCY_REF_MS*W_LATENCY); coveragePenalty=W_COVERAGE se sem docs indexados",
    weights: W,
    components: {
      missPenalty,
      handoffPenalty,
      failurePenalty,
      latencyPenalty,
      coveragePenalty
    }
  };
}

export default computeAiAgentHealthScore;
