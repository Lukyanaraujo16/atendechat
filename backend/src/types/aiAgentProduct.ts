/**
 * Tipos comerciais da Product API do Agente de IA (Fase 2.0 / hardening 2.0.1).
 * Alinhados a ARCHITECTURE_LOCK.md §11 e AI_AGENT_PRODUCT_API_CONTRACT.md
 */

export type AgentProductStatus =
  | "not_created"
  | "setup_incomplete"
  | "ready_to_activate"
  | "active"
  | "paused"
  | "attention_required"
  | "unavailable";

/**
 * paused no modo é reservado até existir sinal de pausa global explícito no domínio.
 * Nesta fase o resolver não emite `paused`.
 */
export type AiAgentProductMode = "off" | "shadow" | "live" | "paused";

export type AiAgentProductCheckStatus =
  | "complete"
  | "pending"
  | "blocked"
  | "warning";

export type AiAgentProductCheckKey =
  | "plan"
  | "agent"
  | "provider"
  | "instructions"
  | "connection"
  | "mode";

export type AiAgentNextAction =
  | "upgrade_plan"
  | "create_agent"
  | "configure_agent"
  | "configure_provider"
  | "connect_whatsapp"
  | "fix_connection"
  | "resolve_conflict"
  | "activate_shadow"
  | "activate_live"
  | "resume_agent"
  | "none";

export type AiAgentProductCheck = {
  key: AiAgentProductCheckKey;
  status: AiAgentProductCheckStatus;
  labelKey: string;
};

export type AiAgentProductReadiness = {
  ready: boolean;
  status: AgentProductStatus;
  mode: AiAgentProductMode;
  nextAction: AiAgentNextAction;
  checks: AiAgentProductCheck[];
};

export type AiAgentProductSummary = {
  availability: {
    enabledByPlan: boolean;
    accessibleByUser: boolean;
  };
  status: AgentProductStatus;
  mode: AiAgentProductMode;
  agent: {
    exists: boolean;
    id?: number;
    name?: string;
    enabled?: boolean;
  };
  connection: {
    linked: boolean;
    name?: string;
    connected?: boolean;
  };
  readiness: AiAgentProductReadiness;
};

/** Ordem determinística de avaliação (menor número = maior prioridade). */
export const AGENT_PRODUCT_STATUS_PRIORITY: Record<AgentProductStatus, number> = {
  unavailable: 1,
  not_created: 2,
  setup_incomplete: 3,
  attention_required: 4,
  paused: 5,
  active: 6,
  ready_to_activate: 7
};
