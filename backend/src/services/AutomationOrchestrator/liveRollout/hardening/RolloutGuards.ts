import { DEFAULT_LIVE_HARDENING_CONFIG } from "../../../../config/automationLiveHardeningConstants";
import {
  getGuardTimestamp,
  setGuardTimestamp
} from "./DistributedMetricsStore";
import { getEvidenceMetricsSnapshot } from "../../evidence/EvidenceMetrics";
import { getLiveRolloutMetricsSnapshot } from "../LiveRolloutMetrics";
import { getDistributedMetricsSnapshot } from "./DistributedMetricsStore";

function rollbackKey(companyId: number): string {
  return `automation:live:guard:rollback:${companyId}`;
}

function promoKey(companyId: number): string {
  return `automation:live:guard:promo:${companyId}`;
}

/**
 * Rollback Guard — cooldown após rollback para evitar oscilação.
 */
export async function canApplyRollback(companyId: number): Promise<{
  allowed: boolean;
  reason: string;
  cooldownRemainingMs: number;
}> {
  const cfg = DEFAULT_LIVE_HARDENING_CONFIG.rollbackGuard;
  const last = await getGuardTimestamp(rollbackKey(companyId));
  if (last == null) {
    return { allowed: true, reason: "no_prior_rollback", cooldownRemainingMs: 0 };
  }
  const elapsed = Date.now() - last;
  const need = Math.max(cfg.cooldownMs, cfg.minIntervalMs);
  if (elapsed < need) {
    return {
      allowed: false,
      reason: "rollback_cooldown",
      cooldownRemainingMs: need - elapsed
    };
  }
  return { allowed: true, reason: "cooldown_elapsed", cooldownRemainingMs: 0 };
}

export async function markRollbackApplied(companyId: number): Promise<void> {
  const cfg = DEFAULT_LIVE_HARDENING_CONFIG.rollbackGuard;
  const ttl = Math.ceil(Math.max(cfg.cooldownMs, cfg.minIntervalMs) / 1000) * 2;
  await setGuardTimestamp(rollbackKey(companyId), ttl);
}

/**
 * Promotion Guard — exige amostras mínimas e confiança.
 */
export async function canPromoteRollout(companyId: number): Promise<{
  allowed: boolean;
  reasons: string[];
  blockers: string[];
}> {
  const cfg = DEFAULT_LIVE_HARDENING_CONFIG.promotionGuard;
  const reasons: string[] = [];
  const blockers: string[] = [];

  const lastRollback = await getGuardTimestamp(rollbackKey(companyId));
  if (lastRollback != null) {
    const elapsed = Date.now() - lastRollback;
    if (elapsed < DEFAULT_LIVE_HARDENING_CONFIG.rollbackGuard.cooldownMs) {
      blockers.push("rollback_cooldown_active");
    }
  }

  const live = getLiveRolloutMetricsSnapshot(companyId);
  const evidence = getEvidenceMetricsSnapshot(companyId);
  const dist = await getDistributedMetricsSnapshot(companyId);

  const executions = Math.max(live.liveExecutions, dist.liveExecutions || 0);
  if (executions < cfg.minExecutions) {
    blockers.push(`min_executions:${executions}<${cfg.minExecutions}`);
  } else {
    reasons.push(`executions_ok:${executions}`);
  }

  if (evidence.sampleCount < cfg.minEvidenceSamples) {
    blockers.push(
      `min_evidence:${evidence.sampleCount}<${cfg.minEvidenceSamples}`
    );
  }

  if (evidence.verificationRate < cfg.minVerificationRate) {
    blockers.push(
      `verification_low:${evidence.verificationRate.toFixed(2)}`
    );
  }

  if (evidence.hallucinationRate > cfg.maxHallucinationRate) {
    blockers.push(
      `hallucination_high:${evidence.hallucinationRate.toFixed(2)}`
    );
  }

  return {
    allowed: blockers.length === 0,
    reasons,
    blockers
  };
}

export async function markPromotionApplied(companyId: number): Promise<void> {
  await setGuardTimestamp(promoKey(companyId), 3600);
}

/**
 * Rollout Guard — combina promoção + rollback + stage transitions.
 */
export async function assertRolloutTransition(input: {
  companyId: number;
  kind: "promote" | "rollback";
}): Promise<{ allowed: boolean; reasons: string[]; blockers: string[] }> {
  if (input.kind === "rollback") {
    const r = await canApplyRollback(input.companyId);
    return {
      allowed: r.allowed,
      reasons: [r.reason],
      blockers: r.allowed ? [] : [r.reason]
    };
  }
  return canPromoteRollout(input.companyId);
}

export default {
  canApplyRollback,
  canPromoteRollout,
  assertRolloutTransition,
  markRollbackApplied,
  markPromotionApplied
};
