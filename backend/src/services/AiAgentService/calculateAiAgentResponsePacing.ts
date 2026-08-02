/**
 * Política central de ritmo natural do AI Agent (Fase 2.18).
 * Determinística nos testes via injeção de jitterRng.
 */

export type AiAgentPacingKind = "normal" | "handoff" | "fallback" | "error";

export type AiAgentResponseLengthBucket = "short" | "medium" | "long" | "empty";

export const AI_AGENT_PACING = {
  absoluteMinMs: 1500,
  shortTargetMs: 2500,
  mediumTargetMs: 4000,
  longTargetMs: 6500,
  absoluteMaxMs: 9000,
  handoffTargetMs: 3000,
  fallbackTargetMs: 1200,
  errorTargetMs: 800,
  /** ms por caractere acima da base (componente leve). */
  msPerCharacter: 18,
  shortMaxChars: 80,
  mediumMaxChars: 250,
  jitterAmplitudeMs: 500,
  /** Intervalo de renovação de composing no WhatsApp. */
  typingRenewIntervalMs: 3500,
  typingMaxDurationMs: 60_000
} as const;

export type CalculateAiAgentResponsePacingInput = {
  responseText?: string | null;
  processingStartedAtMs: number;
  nowMs?: number;
  kind?: AiAgentPacingKind;
  /** 0..1; default Math.random — injetável nos testes. */
  jitterRng?: () => number;
};

export type CalculateAiAgentResponsePacingResult = {
  responseLength: number;
  responseLengthBucket: AiAgentResponseLengthBucket;
  processingDurationMs: number;
  targetDurationMs: number;
  remainingDelayMs: number;
  jitterMs: number;
};

export function bucketAiAgentResponseLength(
  text: string | null | undefined
): AiAgentResponseLengthBucket {
  const len = String(text || "").trim().length;
  if (len <= 0) return "empty";
  if (len <= AI_AGENT_PACING.shortMaxChars) return "short";
  if (len <= AI_AGENT_PACING.mediumMaxChars) return "medium";
  return "long";
}

function baseTargetForBucket(
  bucket: AiAgentResponseLengthBucket,
  kind: AiAgentPacingKind
): number {
  if (kind === "error") return AI_AGENT_PACING.errorTargetMs;
  if (kind === "fallback") return AI_AGENT_PACING.fallbackTargetMs;
  if (kind === "handoff") return AI_AGENT_PACING.handoffTargetMs;
  if (bucket === "empty") return AI_AGENT_PACING.fallbackTargetMs;
  if (bucket === "short") return AI_AGENT_PACING.shortTargetMs;
  if (bucket === "medium") return AI_AGENT_PACING.mediumTargetMs;
  return AI_AGENT_PACING.longTargetMs;
}

/**
 * Calcula atraso restante descontando o tempo já gasto no provider/multimodal.
 */
export function calculateAiAgentResponsePacing(
  input: CalculateAiAgentResponsePacingInput
): CalculateAiAgentResponsePacingResult {
  const kind = input.kind || "normal";
  const now = input.nowMs ?? Date.now();
  const processingDurationMs = Math.max(0, now - input.processingStartedAtMs);
  const text = String(input.responseText || "");
  const responseLength = text.trim().length;
  const responseLengthBucket = bucketAiAgentResponseLength(text);

  let target = baseTargetForBucket(responseLengthBucket, kind);

  // Componente leve por caracteres (com teto) — só no fluxo normal.
  if (kind === "normal" && responseLength > 0) {
    const charComponent = Math.min(
      2500,
      Math.floor(responseLength * AI_AGENT_PACING.msPerCharacter * 0.15)
    );
    target += charComponent;
  }

  // Error/fallback: curtos, sem forçar o mínimo absoluto de respostas naturais.
  if (kind === "error") {
    target = AI_AGENT_PACING.errorTargetMs;
  } else if (kind === "fallback") {
    target = AI_AGENT_PACING.fallbackTargetMs;
  } else {
    target = Math.max(AI_AGENT_PACING.absoluteMinMs, target);
    target = Math.min(AI_AGENT_PACING.absoluteMaxMs, target);
  }

  const rng = input.jitterRng || Math.random;
  const unit = Math.max(0, Math.min(1, Number(rng()) || 0));
  // Error/fallback: jitter menor (±200ms) para não alongar falhas técnicas.
  const jitterAmp =
    kind === "error" || kind === "fallback"
      ? Math.min(200, AI_AGENT_PACING.jitterAmplitudeMs)
      : AI_AGENT_PACING.jitterAmplitudeMs;
  const jitterMs = Math.round((unit * 2 - 1) * jitterAmp);

  let targetWithJitter = target + jitterMs;
  if (kind === "error") {
    targetWithJitter = Math.max(
      0,
      Math.min(targetWithJitter, AI_AGENT_PACING.errorTargetMs + 200)
    );
  } else if (kind === "fallback") {
    targetWithJitter = Math.max(
      800,
      Math.min(targetWithJitter, AI_AGENT_PACING.fallbackTargetMs + 200)
    );
  } else {
    targetWithJitter = Math.max(
      AI_AGENT_PACING.absoluteMinMs,
      targetWithJitter
    );
    targetWithJitter = Math.min(
      AI_AGENT_PACING.absoluteMaxMs,
      targetWithJitter
    );
  }

  const remainingDelayMs = Math.max(0, targetWithJitter - processingDurationMs);

  return {
    responseLength,
    responseLengthBucket,
    processingDurationMs,
    targetDurationMs: targetWithJitter,
    remainingDelayMs,
    jitterMs
  };
}

export async function waitAiAgentPacingDelay(
  remainingDelayMs: number,
  opts?: { signal?: AbortSignal; sleepFn?: (ms: number) => Promise<void> }
): Promise<"completed" | "cancelled"> {
  const ms = Math.max(0, Math.floor(remainingDelayMs));
  if (ms <= 0) return "completed";
  if (opts?.signal?.aborted) return "cancelled";

  const sleep =
    opts?.sleepFn ||
    ((delayMs: number) =>
      new Promise<void>(resolve => {
        setTimeout(resolve, delayMs);
      }));

  if (!opts?.signal) {
    await sleep(ms);
    return "completed";
  }

  return new Promise(resolve => {
    let settled = false;
    let onAbort: () => void = () => undefined;
    function finish(result: "completed" | "cancelled") {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    }
    onAbort = () => finish("cancelled");
    opts.signal.addEventListener("abort", onAbort, { once: true });
    sleep(ms)
      .then(() => finish("completed"))
      .catch(() => finish("cancelled"));
  });
}
