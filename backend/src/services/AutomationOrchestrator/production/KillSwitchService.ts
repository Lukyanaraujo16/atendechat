import AppError from "../../../errors/AppError";
import {
  AGENTOS_KILL_SWITCH_MODULE_KEY,
  AgentOsKillSwitchScope
} from "../../../config/automationAgentOsProductionConstants";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { getAgentOsCacheProvider } from "../scalability/providers";
import { emitAgentOsEvent } from "../observability/AgentOsEventBus";
import { createTraceContext } from "../observability/types";
import { invalidateTenantCache } from "../scalability/CacheAndLocks";

export type KillSwitchEntry = {
  scope: AgentOsKillSwitchScope;
  resourceId: string;
  enabled: boolean;
  reason: string;
  userId: number | null;
  updatedAt: string;
};

type KillSwitchStore = {
  entries: KillSwitchEntry[];
  version: number;
};

const GLOBAL_COMPANY_ID = 0;
const memStores = new Map<number, KillSwitchStore>();

function storeKey(companyId: number) {
  return `kill:${companyId}`;
}

async function loadStore(companyId: number): Promise<KillSwitchStore> {
  const cached = await getAgentOsCacheProvider().get(storeKey(companyId));
  if (cached) {
    try {
      return JSON.parse(cached) as KillSwitchStore;
    } catch {
      /* */
    }
  }
  if (memStores.has(companyId)) {
    return memStores.get(companyId)!;
  }
  const row = await observabilityRepository.getSetting(
    companyId || 1,
    companyId === GLOBAL_COMPANY_ID
      ? `${AGENTOS_KILL_SWITCH_MODULE_KEY}.global`
      : AGENTOS_KILL_SWITCH_MODULE_KEY
  );
  if (row?.config) {
    const store = row.config as KillSwitchStore;
    memStores.set(companyId, store);
    return store;
  }
  return { entries: [], version: 1 };
}

async function saveStore(
  companyId: number,
  store: KillSwitchStore,
  userId?: number | null
): Promise<void> {
  const moduleKey =
    companyId === GLOBAL_COMPANY_ID
      ? `${AGENTOS_KILL_SWITCH_MODULE_KEY}.global`
      : AGENTOS_KILL_SWITCH_MODULE_KEY;
  // global persisted under company 1 settings namespace with dedicated key
  const persistCompanyId = companyId === GLOBAL_COMPANY_ID ? 1 : companyId;
  memStores.set(companyId, store);
  await observabilityRepository.putSetting(
    persistCompanyId,
    moduleKey,
    store as any,
    userId ?? null
  );
  await getAgentOsCacheProvider().set(
    storeKey(companyId),
    JSON.stringify(store),
    10_000
  );
  if (companyId > 0) await invalidateTenantCache(companyId, "kill");
}

/**
 * Precedência: Global → Component → Provider → Tenant → Resource.
 * Deny superior sempre vence.
 */
export async function resolveKillSwitch(input: {
  companyId: number;
  component?: string;
  providerId?: string;
  agentId?: string;
  whatsappId?: number | string;
  queueId?: number | string;
  toolId?: string;
  mcpServerId?: string;
  mcpToolId?: string;
  sessionId?: string;
}): Promise<{ denied: boolean; matched: KillSwitchEntry | null; reasonCode: string }> {
  const global = await loadStore(GLOBAL_COMPANY_ID);
  const tenant = await loadStore(input.companyId);

  const checks: Array<{ scope: AgentOsKillSwitchScope; id: string }> = [
    { scope: "global", id: "*" },
    { scope: "component", id: input.component || "" },
    { scope: "provider", id: input.providerId || "" },
    { scope: "tenant", id: String(input.companyId) },
    { scope: "agent", id: input.agentId || "" },
    { scope: "whatsapp", id: String(input.whatsappId || "") },
    { scope: "queue", id: String(input.queueId || "") },
    { scope: "tool", id: input.toolId || "" },
    { scope: "mcp_server", id: input.mcpServerId || "" },
    { scope: "mcp_tool", id: input.mcpToolId || "" },
    { scope: "session", id: input.sessionId || "" }
  ];

  const all = [...global.entries, ...tenant.entries].filter(e => e.enabled);
  for (const check of checks) {
    if (!check.id && check.scope !== "global") continue;
    const hit = all.find(
      e =>
        e.scope === check.scope &&
        (e.resourceId === check.id || e.resourceId === "*")
    );
    if (hit) {
      return {
        denied: true,
        matched: hit,
        reasonCode: `KILL_SWITCH_${check.scope.toUpperCase()}`
      };
    }
  }
  return { denied: false, matched: null, reasonCode: "OK" };
}

export async function setKillSwitch(input: {
  companyId: number;
  scope: AgentOsKillSwitchScope;
  resourceId: string;
  enabled: boolean;
  reason: string;
  userId: number;
  confirm: boolean;
}): Promise<KillSwitchEntry> {
  if (input.confirm !== true) {
    throw new AppError("ERR_CONFIRMATION_REQUIRED", 400);
  }
  if (!input.reason || input.reason.trim().length < 3) {
    throw new AppError("ERR_VALIDATION", 400, "reason obrigatório");
  }

  const targetCompany =
    input.scope === "global" ? GLOBAL_COMPANY_ID : input.companyId;
  const store = await loadStore(targetCompany);
  const entry: KillSwitchEntry = {
    scope: input.scope,
    resourceId: input.resourceId || "*",
    enabled: input.enabled,
    reason: input.reason,
    userId: input.userId,
    updatedAt: new Date().toISOString()
  };
  store.entries = store.entries.filter(
    e => !(e.scope === entry.scope && e.resourceId === entry.resourceId)
  );
  store.entries.push(entry);
  store.version += 1;
  await saveStore(targetCompany, store, input.userId);

  const ctx = createTraceContext({ companyId: input.companyId });
  emitAgentOsEvent({
    ctx,
    type: input.enabled ? "KILL_SWITCH_ENABLED" : "KILL_SWITCH_DISABLED",
    origin: "ops",
    severity: "critical",
    payload: {
      scope: entry.scope,
      resourceId: entry.resourceId,
      reason: entry.reason
    }
  });
  observabilityRepository.writeAuditFireAndForget({
    companyId: input.companyId,
    moduleKey: AGENTOS_KILL_SWITCH_MODULE_KEY,
    action: input.enabled ? "KILL_SWITCH_ENABLED" : "KILL_SWITCH_DISABLED",
    userId: input.userId,
    reasonCodes: [input.reason],
    payloadSanitized: {
      scope: entry.scope,
      resourceId: entry.resourceId
    }
  });

  return entry;
}

export async function listKillSwitches(companyId: number) {
  const global = await loadStore(GLOBAL_COMPANY_ID);
  const tenant = await loadStore(companyId);
  return {
    global: global.entries,
    tenant: tenant.entries
  };
}

export async function emergencyStop(input: {
  companyId: number;
  userId: number;
  reason: string;
  confirm: boolean;
  scope?: "tenant" | "global";
}) {
  if (input.confirm !== true) {
    throw new AppError("ERR_CONFIRMATION_REQUIRED", 400);
  }
  await setKillSwitch({
    companyId: input.companyId,
    scope: input.scope === "global" ? "global" : "tenant",
    resourceId: input.scope === "global" ? "*" : String(input.companyId),
    enabled: true,
    reason: input.reason,
    userId: input.userId,
    confirm: true
  });

  // Also force rollout to SUSPENDED for tenant
  const { loadRolloutConfig, saveRolloutConfig } = await import(
    "./RolloutStateMachine"
  );
  const cfg = await loadRolloutConfig(input.companyId);
  cfg.previousRolloutState = cfg.rolloutState;
  cfg.rolloutState = "SUSPENDED";
  cfg.suspendedAt = new Date().toISOString();
  cfg.suspendedReason = input.reason;
  cfg.flags.liveEnabled = false;
  cfg.flags.toolWriteEnabled = false;
  cfg.flags.mcpWriteEnabled = false;
  cfg.flags.coordinatorLiveEnabled = false;
  cfg.flags.multiAgentLiveEnabled = false;
  cfg.version += 1;
  await saveRolloutConfig(cfg, input.userId);

  const ctx = createTraceContext({ companyId: input.companyId });
  emitAgentOsEvent({
    ctx,
    type: "EMERGENCY_STOP",
    origin: "ops",
    severity: "critical",
    payload: { reason: input.reason }
  });

  return {
    ok: true,
    classification: {
      SAFE_TO_COMPLETE: true,
      SAFE_TO_CANCEL: true,
      AMBIGUOUS_WRITE: "MUST_REVIEW",
      MUST_REVIEW: true
    },
    effects: [
      "no_new_executions",
      "no_live_response",
      "no_tool_write",
      "no_mcp_write",
      "no_delegation",
      "no_handoff",
      "no_coordinator",
      "observability_preserved",
      "audit_preserved"
    ]
  };
}

export async function resetKillSwitchesForTests(): Promise<void> {
  memStores.clear();
  await getAgentOsCacheProvider().del(storeKey(GLOBAL_COMPANY_ID));
  for (const cid of [0, 1, 91005, 91006, 92001, 92002, 93001]) {
    await getAgentOsCacheProvider().del(storeKey(cid));
    memStores.set(cid === 0 ? GLOBAL_COMPANY_ID : cid, { entries: [], version: 1 });
  }
}
