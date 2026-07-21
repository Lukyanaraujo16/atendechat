/**
 * Fase IA 2.2 — Live Function Calling (rollout progressivo).
 */

export const AUTOMATION_LIVE_ROLLOUT_VERSION = "2.2.0";

export const LIVE_ROLLOUT_SETTING_KEY = "automationLiveRollout";
export const LIVE_KILL_SWITCH_SETTING_KEY = "automationLiveKillSwitch";
export const LIVE_FC_COMPANY_SETTING_KEY = "functionCallingLive";

export const LIVE_ROLLOUT_STAGES = [
  "DISABLED",
  "SIMULATOR",
  "SHADOW",
  "CANARY",
  "PARTIAL",
  "FULL"
] as const;

export type LiveRolloutStage = (typeof LIVE_ROLLOUT_STAGES)[number];

/** Estágios que podem executar FC em produção (com canary/percent). */
export const LIVE_EXECUTABLE_STAGES: LiveRolloutStage[] = [
  "CANARY",
  "PARTIAL",
  "FULL"
];

export const LIVE_CANARY_PERCENTS = [0, 5, 10, 25, 50, 100] as const;

export const KILL_SWITCH_SCOPES = [
  "global",
  "company",
  "connection",
  "agent",
  "provider",
  "tool"
] as const;

export type KillSwitchScope = (typeof KILL_SWITCH_SCOPES)[number];

export type LiveMessagePolicy = {
  inboundOnly: boolean;
  textOnly: boolean;
  noAudio: boolean;
  noMedia: boolean;
  openTicketOnly: boolean;
  unassignedOnly: boolean;
  firstMessageOnly: boolean;
};

export type LiveAutoRollbackConfig = {
  enabled: boolean;
  maxHallucinationRate: number;
  maxToolFailureRate: number;
  maxLatencyMs: number;
  /** Percentuais progressivos ao rebaixar (ex.: 50→25→10→0). */
  steps: number[];
};

export type LiveProgressiveStep = {
  percent: number;
  holdHours: number;
};

export type LiveRolloutConfig = {
  stage: LiveRolloutStage;
  /** 0–100; usado em CANARY/PARTIAL. FULL força 100. */
  percent: number;
  allowWriteToolsLive: boolean;
  messagePolicy: LiveMessagePolicy;
  autoRollback: LiveAutoRollbackConfig;
  /** Infraestrutura apenas — sem scheduler. */
  progressive: {
    enabled: boolean;
    plan: LiveProgressiveStep[];
  };
  providersAllowed: Array<"openai" | "gemini">;
};

export const DEFAULT_LIVE_ROLLOUT_CONFIG: LiveRolloutConfig = {
  stage: "DISABLED",
  percent: 0,
  allowWriteToolsLive: false,
  messagePolicy: {
    inboundOnly: true,
    textOnly: true,
    noAudio: true,
    noMedia: true,
    openTicketOnly: true,
    unassignedOnly: false,
    firstMessageOnly: false
  },
  autoRollback: {
    enabled: true,
    maxHallucinationRate: 0.15,
    maxToolFailureRate: 0.25,
    maxLatencyMs: 15000,
    steps: [50, 25, 10, 5, 0]
  },
  progressive: {
    enabled: false,
    plan: [
      { percent: 5, holdHours: 24 },
      { percent: 10, holdHours: 24 },
      { percent: 25, holdHours: 24 },
      { percent: 50, holdHours: 48 },
      { percent: 100, holdHours: 0 }
    ]
  },
  providersAllowed: ["openai", "gemini"]
};
