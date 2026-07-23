import AppError from "../../../errors/AppError";
import {
  AGENTOS_ROLLOUT_TRANSITIONS,
  AgentOsRolloutState,
  AGENTOS_ROLLOUT_MODULE_KEY,
  AgentOsRolloutConfig,
  defaultRolloutConfig,
  DEFAULT_AGENTOS_PRODUCTION_FLAGS
} from "../../../config/automationAgentOsProductionConstants";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { assertOptimisticVersion, nextVersion } from "../scalability/OptimisticLock";
import { emitAgentOsEvent } from "../observability/AgentOsEventBus";
import { createTraceContext } from "../observability/types";
import { invalidateTenantCache } from "../scalability/CacheAndLocks";
import { getAgentOsCacheProvider } from "../scalability/providers";

const mem = new Map<number, AgentOsRolloutConfig>();

function cacheKey(companyId: number) {
  return `rollout:cfg:${companyId}`;
}

export async function loadRolloutConfig(
  companyId: number
): Promise<AgentOsRolloutConfig> {
  const cached = await getAgentOsCacheProvider().get(cacheKey(companyId));
  if (cached) {
    try {
      return JSON.parse(cached) as AgentOsRolloutConfig;
    } catch {
      /* fall through */
    }
  }
  if (mem.has(companyId)) return mem.get(companyId)!;

  const row = await observabilityRepository.getSetting(
    companyId,
    AGENTOS_ROLLOUT_MODULE_KEY
  );
  if (row?.config) {
    const cfg = {
      ...defaultRolloutConfig(companyId),
      ...(row.config as any),
      companyId,
      version: row.version || 1,
      flags: {
        ...DEFAULT_AGENTOS_PRODUCTION_FLAGS,
        ...((row.config as any).flags || {})
      }
    } as AgentOsRolloutConfig;
    // Enforce production defaults cannot be silently true from corrupt data
    cfg.flags = {
      ...cfg.flags,
      globalEnabled: cfg.flags.globalEnabled === true,
      liveEnabled: false, // hard default unless explicit transition path
      multiAgentLiveEnabled: false,
      coordinatorLiveEnabled: false,
      learningAutoPromotionEnabled: false,
      mcpWriteEnabled: false,
      toolWriteEnabled: false,
      autoRollbackEnabled: cfg.flags.autoRollbackEnabled === true,
      defaultRolloutState: "DISABLED"
    };
    // live only if state allows AND flag — still default false on fresh
    if (
      cfg.rolloutState !== "CANARY" &&
      cfg.rolloutState !== "CONTROLLED_PRODUCTION" &&
      cfg.rolloutState !== "TENANT_ALLOWLIST"
    ) {
      cfg.flags.liveEnabled = false;
    }
    mem.set(companyId, cfg);
    await getAgentOsCacheProvider().set(
      cacheKey(companyId),
      JSON.stringify(cfg),
      15_000
    );
    return cfg;
  }

  const fresh = defaultRolloutConfig(companyId);
  mem.set(companyId, fresh);
  return fresh;
}

export async function saveRolloutConfig(
  cfg: AgentOsRolloutConfig,
  userId?: number | null
): Promise<AgentOsRolloutConfig> {
  cfg.updatedAt = new Date().toISOString();
  mem.set(cfg.companyId, cfg);
  await observabilityRepository.putSetting(
    cfg.companyId,
    AGENTOS_ROLLOUT_MODULE_KEY,
    cfg as any,
    userId ?? null
  );
  await getAgentOsCacheProvider().del(cacheKey(cfg.companyId));
  await invalidateTenantCache(cfg.companyId, "rollout");
  return cfg;
}

export function assertValidTransition(
  from: AgentOsRolloutState,
  to: AgentOsRolloutState
): void {
  const allowed = AGENTOS_ROLLOUT_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new AppError(
      "ERR_ROLLOUT_TRANSITION_FORBIDDEN",
      400,
      `Transição ${from} → ${to} não permitida`
    );
  }
}

export async function transitionRollout(input: {
  companyId: number;
  to: AgentOsRolloutState;
  expectedVersion: number;
  userId: number;
  reason: string;
  confirm: boolean;
  acceptWarnings?: boolean;
}): Promise<AgentOsRolloutConfig> {
  if (input.confirm !== true) {
    throw new AppError("ERR_CONFIRMATION_REQUIRED", 400, "confirm: true obrigatório");
  }
  if (!input.reason || String(input.reason).trim().length < 3) {
    throw new AppError("ERR_VALIDATION", 400, "reason obrigatório");
  }

  const cfg = await loadRolloutConfig(input.companyId);
  assertOptimisticVersion(cfg.version, input.expectedVersion);
  assertValidTransition(cfg.rolloutState, input.to);

  const needsPreflight = (
    ["TENANT_ALLOWLIST", "CANARY", "CONTROLLED_PRODUCTION"] as AgentOsRolloutState[]
  ).includes(input.to);
  if (needsPreflight) {
    const { runPreflight } = await import("./PreflightAndReadiness");
    const preflight = await runPreflight(input.companyId);
    emitAgentOsEvent({
      ctx: createTraceContext({ companyId: input.companyId }),
      type: "ROLLOUT_PREFLIGHT_COMPLETED",
      origin: "ops",
      severity: preflight.status === "FAIL" ? "error" : "info",
      payload: { status: preflight.status, to: input.to }
    });
    if (preflight.status === "FAIL") {
      throw new AppError(
        "ERR_ROLLOUT_PREFLIGHT_FAILED",
        400,
        "Preflight FAIL bloqueia a transição"
      );
    }
    if (
      preflight.status === "PASS_WITH_WARNINGS" &&
      input.acceptWarnings !== true
    ) {
      throw new AppError(
        "ERR_ROLLOUT_PREFLIGHT_WARNINGS",
        400,
        "Aceitar warnings explicitamente (acceptWarnings: true)"
      );
    }
  }

  const ctx = createTraceContext({ companyId: input.companyId });
  emitAgentOsEvent({
    ctx,
    type: "ROLLOUT_TRANSITION_REQUESTED",
    origin: "ops",
    severity: "info",
    payload: {
      from: cfg.rolloutState,
      to: input.to,
      userId: input.userId,
      reason: input.reason
    }
  });

  const previous = cfg.rolloutState;
  cfg.previousRolloutState = previous;
  cfg.rolloutState = input.to;
  cfg.lastTransitionAt = new Date().toISOString();
  cfg.lastTransitionBy = input.userId;
  cfg.version = nextVersion(cfg.version);

  if (input.to === "SUSPENDED") {
    cfg.suspendedAt = cfg.lastTransitionAt;
    cfg.suspendedReason = input.reason;
  }
  if (input.to === "DISABLED" || input.to === "ROLLBACK" || input.to === "SHADOW") {
    cfg.flags.liveEnabled = false;
    cfg.flags.mcpWriteEnabled = false;
    cfg.flags.toolWriteEnabled = false;
    cfg.flags.coordinatorLiveEnabled = false;
    cfg.flags.multiAgentLiveEnabled = false;
  }
  if (input.to === "DISABLED") {
    cfg.flags.globalEnabled = false;
  }
  if (input.to === "INTERNAL_ONLY" || input.to === "SHADOW") {
    cfg.flags.globalEnabled = true;
    cfg.flags.liveEnabled = false;
  }

  await saveRolloutConfig(cfg, input.userId);

  observabilityRepository.writeAuditFireAndForget({
    companyId: input.companyId,
    moduleKey: AGENTOS_ROLLOUT_MODULE_KEY,
    action: "ROLLOUT_TRANSITION_COMPLETED",
    userId: input.userId,
    previousState: previous,
    newState: input.to,
    reasonCodes: [input.reason],
    payloadSanitized: {
      version: cfg.version,
      traceId: ctx.traceId
    }
  });

  emitAgentOsEvent({
    ctx,
    type: "ROLLOUT_TRANSITION_COMPLETED",
    origin: "ops",
    severity: "info",
    payload: { from: previous, to: input.to }
  });

  return cfg;
}

export function resetRolloutMemory(): void {
  mem.clear();
}
