import Setting from "../../../models/Setting";
import {
  DEFAULT_LIVE_ROLLOUT_CONFIG,
  LIVE_KILL_SWITCH_SETTING_KEY,
  LIVE_ROLLOUT_SETTING_KEY,
  LiveRolloutConfig,
  LiveRolloutStage,
  KillSwitchScope
} from "../../../config/automationLiveRolloutConstants";

type KillSwitchState = {
  global: boolean;
  companies: Record<number, boolean>;
  connections: Record<number, boolean>;
  agents: Record<number, boolean>;
  providers: Record<string, boolean>;
  tools: Record<string, boolean>;
};

const killMemory = new Map<number, KillSwitchState>();
let globalKill = false;

function emptyKill(): KillSwitchState {
  return {
    global: false,
    companies: {},
    connections: {},
    agents: {},
    providers: {},
    tools: {}
  };
}

export async function loadLiveRolloutConfig(
  companyId: number
): Promise<LiveRolloutConfig> {
  const row = await Setting.findOne({
    where: { companyId, key: LIVE_ROLLOUT_SETTING_KEY }
  });
  if (!row?.value) {
    return JSON.parse(JSON.stringify(DEFAULT_LIVE_ROLLOUT_CONFIG));
  }
  try {
    return mergeLiveRolloutConfig(JSON.parse(row.value));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_LIVE_ROLLOUT_CONFIG));
  }
}

export async function saveLiveRolloutConfig(
  companyId: number,
  partial: Partial<LiveRolloutConfig>
): Promise<LiveRolloutConfig> {
  const current = await loadLiveRolloutConfig(companyId);
  const merged = mergeLiveRolloutConfig({ ...current, ...partial });
  // allowWriteToolsLive só muda se explicitamente enviado
  if (typeof partial.allowWriteToolsLive === "boolean") {
    merged.allowWriteToolsLive = partial.allowWriteToolsLive;
  } else {
    merged.allowWriteToolsLive = current.allowWriteToolsLive === true;
  }

  const value = JSON.stringify(merged);
  const [row] = await Setting.findOrCreate({
    where: { companyId, key: LIVE_ROLLOUT_SETTING_KEY },
    defaults: { companyId, key: LIVE_ROLLOUT_SETTING_KEY, value }
  });
  await row.update({ value });
  return merged;
}

export function mergeLiveRolloutConfig(
  partial: Partial<LiveRolloutConfig> | Record<string, unknown>
): LiveRolloutConfig {
  const base: LiveRolloutConfig = JSON.parse(
    JSON.stringify(DEFAULT_LIVE_ROLLOUT_CONFIG)
  );
  const p = partial as LiveRolloutConfig;
  if (p.stage) base.stage = p.stage;
  if (typeof p.percent === "number") base.percent = p.percent;
  if (typeof p.allowWriteToolsLive === "boolean") {
    base.allowWriteToolsLive = p.allowWriteToolsLive;
  }
  if (p.messagePolicy) {
    base.messagePolicy = { ...base.messagePolicy, ...p.messagePolicy };
  }
  if (p.autoRollback) {
    base.autoRollback = { ...base.autoRollback, ...p.autoRollback };
  }
  if (p.progressive) {
    base.progressive = {
      ...base.progressive,
      ...p.progressive,
      plan: Array.isArray(p.progressive.plan)
        ? p.progressive.plan
        : base.progressive.plan
    };
  }
  if (Array.isArray(p.providersAllowed)) {
    base.providersAllowed = p.providersAllowed.filter(
      (x): x is "openai" | "gemini" => x === "openai" || x === "gemini"
    ) as Array<"openai" | "gemini">;
  }
  return base;
}

/** Kill switch — imediato, sem restart. */
export function setKillSwitch(input: {
  scope: KillSwitchScope;
  companyId?: number;
  targetId?: number | string;
  enabled: boolean;
}): void {
  if (input.scope === "global") {
    globalKill = input.enabled === true;
    return;
  }
  const companyId = input.companyId ?? 0;
  let state = killMemory.get(companyId);
  if (!state) {
    state = emptyKill();
    killMemory.set(companyId, state);
  }
  const on = input.enabled === true;
  if (input.scope === "company") {
    state.companies[companyId] = on;
  } else if (input.scope === "connection" && input.targetId != null) {
    state.connections[Number(input.targetId)] = on;
  } else if (input.scope === "agent" && input.targetId != null) {
    state.agents[Number(input.targetId)] = on;
  } else if (input.scope === "provider" && input.targetId != null) {
    state.providers[String(input.targetId)] = on;
  } else if (input.scope === "tool" && input.targetId != null) {
    state.tools[String(input.targetId)] = on;
  }
}

export function isKillSwitchActive(input: {
  companyId: number;
  connectionId?: number | null;
  agentId?: number | null;
  provider?: string | null;
  toolId?: string | null;
}): { active: boolean; scope?: KillSwitchScope; reason?: string } {
  if (globalKill) {
    return { active: true, scope: "global", reason: "kill_global" };
  }
  const state = killMemory.get(input.companyId) || emptyKill();
  if (state.companies[input.companyId]) {
    return { active: true, scope: "company", reason: "kill_company" };
  }
  if (
    input.connectionId != null &&
    state.connections[input.connectionId]
  ) {
    return { active: true, scope: "connection", reason: "kill_connection" };
  }
  if (input.agentId != null && state.agents[input.agentId]) {
    return { active: true, scope: "agent", reason: "kill_agent" };
  }
  if (input.provider && state.providers[input.provider]) {
    return { active: true, scope: "provider", reason: "kill_provider" };
  }
  if (input.toolId && state.tools[input.toolId]) {
    return { active: true, scope: "tool", reason: "kill_tool" };
  }
  return { active: false };
}

export function getKillSwitchSnapshot(companyId: number) {
  return {
    global: globalKill,
    ...(killMemory.get(companyId) || emptyKill())
  };
}

export async function persistCompanyKillSwitch(
  companyId: number,
  enabled: boolean
): Promise<void> {
  setKillSwitch({ scope: "company", companyId, enabled });
  const value = enabled ? "enabled" : "disabled";
  const [row] = await Setting.findOrCreate({
    where: { companyId, key: LIVE_KILL_SWITCH_SETTING_KEY },
    defaults: { companyId, key: LIVE_KILL_SWITCH_SETTING_KEY, value }
  });
  await row.update({ value });
}

export async function hydrateCompanyKillSwitch(
  companyId: number
): Promise<void> {
  const row = await Setting.findOne({
    where: { companyId, key: LIVE_KILL_SWITCH_SETTING_KEY }
  });
  if (row?.value === "enabled" || row?.value === "true") {
    setKillSwitch({ scope: "company", companyId, enabled: true });
  }
}

export function __resetLiveKillSwitchForTests(): void {
  globalKill = false;
  killMemory.clear();
}

export function stageAllowsLiveExecution(stage: LiveRolloutStage): boolean {
  return stage === "CANARY" || stage === "PARTIAL" || stage === "FULL";
}

export default {
  loadLiveRolloutConfig,
  saveLiveRolloutConfig,
  setKillSwitch,
  isKillSwitchActive
};
