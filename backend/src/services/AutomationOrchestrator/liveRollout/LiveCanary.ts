import { createHash } from "crypto";
import {
  LIVE_CANARY_PERCENTS,
  LiveRolloutStage,
  LIVE_EXECUTABLE_STAGES
} from "../../../config/automationLiveRolloutConstants";

/**
 * Hash determinístico 0–99 para canary.
 * Nunca aleatório por requisição.
 */
export function canaryBucket(input: {
  companyId: number;
  ticketId: number;
  messageId?: string | null;
  connectionId?: number | null;
  agentId?: number | null;
}): number {
  const key = [
    input.companyId,
    input.ticketId,
    input.messageId || "",
    input.connectionId ?? "",
    input.agentId ?? ""
  ].join(":");
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 8);
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n % 100 : 0;
}

/**
 * true se o bucket está dentro do percentual configurado.
 * percent 0 → nunca; 100 → sempre.
 */
export function isInCanaryPercent(
  bucket: number,
  percent: number
): boolean {
  const p = Math.max(0, Math.min(100, Math.floor(percent)));
  if (p <= 0) return false;
  if (p >= 100) return true;
  return bucket < p;
}

export function resolveEffectivePercent(input: {
  stage: LiveRolloutStage;
  percent: number;
}): number {
  if (!LIVE_EXECUTABLE_STAGES.includes(input.stage)) return 0;
  if (input.stage === "FULL") return 100;
  const p = Math.max(0, Math.min(100, Math.floor(input.percent)));
  // Snap para valores conhecidos se próximo; senão usa o valor bruto
  const nearest = LIVE_CANARY_PERCENTS.reduce((best, cur) =>
    Math.abs(cur - p) < Math.abs(best - p) ? cur : best
  );
  return Math.abs(nearest - p) <= 2 ? nearest : p;
}

export function evaluateCanary(input: {
  stage: LiveRolloutStage;
  percent: number;
  companyId: number;
  ticketId: number;
  messageId?: string | null;
  connectionId?: number | null;
  agentId?: number | null;
}): {
  eligible: boolean;
  bucket: number;
  effectivePercent: number;
  reason: string;
} {
  const effectivePercent = resolveEffectivePercent(input);
  const bucket = canaryBucket(input);

  if (!LIVE_EXECUTABLE_STAGES.includes(input.stage)) {
    return {
      eligible: false,
      bucket,
      effectivePercent: 0,
      reason: `stage_not_executable:${input.stage}`
    };
  }

  const inPercent = isInCanaryPercent(bucket, effectivePercent);
  return {
    eligible: inPercent,
    bucket,
    effectivePercent,
    reason: inPercent
      ? `canary_in:${bucket}<${effectivePercent}`
      : `canary_out:${bucket}>=${effectivePercent}`
  };
}

export default { canaryBucket, isInCanaryPercent, evaluateCanary };
