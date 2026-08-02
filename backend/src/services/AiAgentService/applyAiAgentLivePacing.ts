import {
  AiAgentPacingKind,
  calculateAiAgentResponsePacing,
  waitAiAgentPacingDelay
} from "./calculateAiAgentResponsePacing";
import { emitAiAgentTypingMetric } from "./startAiAgentTypingPresence";

/**
 * Aplica atraso restante do pacing Live (desconta tempo já gasto).
 */
export async function applyAiAgentLivePacing(input: {
  processingStartedAtMs: number;
  responseText?: string | null;
  kind?: AiAgentPacingKind;
  companyId: number;
  ticketId: number;
  agentId?: number | null;
  whatsappId?: number | null;
  executionId: string;
  jitterRng?: () => number;
  sleepFn?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}): Promise<void> {
  const pacing = calculateAiAgentResponsePacing({
    responseText: input.responseText,
    processingStartedAtMs: input.processingStartedAtMs,
    kind: input.kind || "normal",
    jitterRng: input.jitterRng
  });

  emitAiAgentTypingMetric("ai_agent.pacing_calculated", {
    companyId: input.companyId,
    ticketId: input.ticketId,
    agentId: input.agentId,
    whatsappId: input.whatsappId,
    executionId: input.executionId,
    processingDurationMs: pacing.processingDurationMs,
    targetDurationMs: pacing.targetDurationMs,
    remainingDelayMs: pacing.remainingDelayMs,
    responseLengthBucket: pacing.responseLengthBucket,
    result: "ok"
  });

  const waitResult = await waitAiAgentPacingDelay(pacing.remainingDelayMs, {
    sleepFn: input.sleepFn,
    signal: input.signal
  });

  emitAiAgentTypingMetric(
    waitResult === "cancelled"
      ? "ai_agent.pacing_cancelled"
      : "ai_agent.pacing_wait_completed",
    {
      companyId: input.companyId,
      ticketId: input.ticketId,
      agentId: input.agentId,
      whatsappId: input.whatsappId,
      executionId: input.executionId,
      remainingDelayMs: pacing.remainingDelayMs,
      reason: waitResult,
      result: waitResult
    }
  );
}
