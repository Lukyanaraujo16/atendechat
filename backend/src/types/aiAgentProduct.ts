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
  | "credential"
  | "model"
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

/**
 * Comandos comerciais de mutação (Fase 2.2).
 * Sem resume_agent — não há pausa global no domínio.
 */
export type AiAgentProductCommand =
  | "activate_shadow"
  | "activate_live"
  | "deactivate";

export const AI_AGENT_PRODUCT_COMMANDS: AiAgentProductCommand[] = [
  "activate_shadow",
  "activate_live",
  "deactivate"
];

export type AiAgentProductCommandResult = {
  command: AiAgentProductCommand;
  changed: boolean;
  /**
   * Escopo afetado pelo comando (Opção A — todas as conexões vinculadas).
   * Allowlist comercial; sem ids técnicos.
   */
  affectedConnections: AiAgentProductAffectedConnections;
  summary: AiAgentProductSummary;
};

/**
 * Escopo comercial das conexões vinculadas ao agente principal.
 * type fixo `all_linked` (Opção A / hardening 2.2.1).
 */
export type AiAgentProductConnectionScope = {
  type: "all_linked";
  count: number;
  connectedCount: number;
  disconnectedCount: number;
  /** Nomes comerciais, ordenados de forma estável (id ASC no backend). */
  names: string[];
};

export type AiAgentProductAffectedConnections = {
  scope: "all_linked";
  count: number;
  names: string[];
  /** Modo agregado antes do comando: off | shadow | live | mixed */
  fromMode: "off" | "shadow" | "live" | "mixed";
  /** Modo alvo / resultante após normalização */
  toMode: "off" | "shadow" | "live";
};

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
  /** Capacidades multimodais do modelo/credencial atual (Fase 2.17). */
  mediaCapabilities?: {
    text: "ready" | "unavailable";
    vision: "ready" | "unavailable";
    audioTranscription: "ready" | "unavailable";
    reason?: {
      vision?: string | null;
      audioTranscription?: string | null;
    };
  };
};

/**
 * Escopo de resolução do agente comercial.
 * Com agentRef explícito ou exatamente um agente → single.
 * Sem agentRef e ≥2 agentes → ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED (não usar ambiguous operacionalmente).
 * O tipo "ambiguous" permanece no contrato apenas para compatibilidade de serialização legada.
 */
export type AiAgentProductAgentScope = {
  type: "none" | "single" | "ambiguous";
  count: number;
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
    /** Referência comercial opaca (Fase 2.9A). */
    agentRef?: string;
    name?: string;
    enabled?: boolean;
  };
  connection: {
    linked: boolean;
    name?: string;
    connected?: boolean;
  };
  /** Impacto do conjunto vinculado (Opção A). */
  connectionScope: AiAgentProductConnectionScope;
  /**
   * Resolução do agente no escopo da operação.
   * Operações agent-scoped com múltiplos agentes exigem agentRef.
   */
  agentScope: AiAgentProductAgentScope;
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

/** Configuração comercial (Fase 2.3). */
export type AiAgentProductConfigurationIdentity = {
  name: string;
  description: string | null;
};

export type AiAgentProductConfigurationMessages = {
  fallbackMessage: string | null;
  handoffMessage: string | null;
};

export type AiAgentProductConfigurationModel = {
  name: string;
  temperature: number;
  maxTokens: number;
};

export type AiAgentProductConfigurationInstructions = {
  configured: boolean;
  preview: string | null;
};

export type AiAgentProductConfigurationProvider = {
  configured: boolean;
  type: string | null;
  label: string | null;
};

export type AiAgentProductConfigurationCredential = {
  configured: boolean;
  label: string | null;
  maskedKey: string | null;
};

export type AiAgentProductConfigurationConnection = {
  ref: string;
  name: string;
  status: string;
  selected: boolean;
};

export type AiAgentProductConfiguration = {
  identity: AiAgentProductConfigurationIdentity;
  messages: AiAgentProductConfigurationMessages;
  model: AiAgentProductConfigurationModel;
  /** Somente os campos comerciais definidos em PROFILE_FIELD_KEYS. */
  profile: Record<string, unknown> | null;
  instructions: AiAgentProductConfigurationInstructions;
  provider: AiAgentProductConfigurationProvider;
  credential: AiAgentProductConfigurationCredential;
  connections: AiAgentProductConfigurationConnection[];
};

export type AiAgentProductConfigurationResult = {
  changed?: boolean;
  created?: boolean;
  /** Referência do agente criado/atualizado (Fase 2.9A). */
  agentRef?: string;
  configuration: AiAgentProductConfiguration | null;
  summary: AiAgentProductSummary;
};

export type AiAgentProductConfigurationView = {
  agentScope: AiAgentProductAgentScope;
  /** Presente quando um agente foi resolvido. */
  agentRef?: string;
  configuration: AiAgentProductConfiguration | null;
  editableWhileActive?: boolean;
  summary: AiAgentProductSummary;
};

export type AiAgentProductConfigurationOptions = {
  providers: Array<{
    value: string;
    label: string;
    available: boolean;
    unavailableReason?: string | null;
  }>;
  models: Array<{
    value: string;
    label: string;
    provider: string;
    supportsText?: boolean;
    supportsVision?: boolean;
    supportsAudioTranscription?: boolean;
  }>;
  credentials: Array<{
    ref: string;
    name: string;
    provider: string;
    maskedKey: string;
    enabled: boolean;
    isDefault: boolean;
  }>;
  connections: Array<{
    ref: string;
    name: string;
    status: string;
    selected: boolean;
    eligible: boolean;
    ineligibleReason: string | null;
    /** Nome comercial do agente que detém a conexão (quando already_assigned). */
    assignedAgentName?: string | null;
    /** agentRef opaco do agente detentor (quando already_assigned). */
    assignedAgentRef?: string | null;
  }>;
};

export type AiAgentProductConfigurationPreview = {
  preview: string;
};

/** Simulator comercial (Fase 2.5). */
export type AiAgentProductSimulatorUnavailableReason =
  | "not_created"
  | "ambiguous"
  | "agent_ref_required"
  | "credential_not_selected"
  | "credential_disabled"
  | "provider_unsupported"
  | "model_incompatible"
  | "simulator_not_configured";

export type AiAgentProductSimulatorReview = {
  rating: string;
  tags: string[];
  note: string | null;
  reviewedAt: string | null;
};

export type AiAgentProductSimulatorMessage = {
  ref: string;
  role: string;
  content: string;
  createdAt: string | null;
  responseTimeMs: number | null;
  handoffSuggested: boolean;
  review: AiAgentProductSimulatorReview | null;
};

export type AiAgentProductSimulatorSession = {
  ref: string;
  status: string;
  providerLabel: string | null;
  modelLabel: string | null;
  messageCount: number;
  startedAt: string | null;
  endedAt: string | null;
  averageResponseTimeMs: number | null;
  messages?: AiAgentProductSimulatorMessage[];
};

export type AiAgentProductSimulatorBootstrap = {
  available: boolean;
  reason: AiAgentProductSimulatorUnavailableReason | null;
  agentScope: AiAgentProductAgentScope;
  agent: {
    name: string | null;
    description: string | null;
    status: AgentProductStatus | null;
    mode: AiAgentProductMode | null;
  };
  capabilities: { canSimulate: boolean; canReview: boolean };
  provider: { label: string | null; modelLabel: string | null };
  scenarioSegment: string | null;
  sessions: AiAgentProductSimulatorSession[];
};

/** Product Credentials (Fase 2.7) — camada sobre AiProviderCredential. */
export type AiAgentProductCredential = {
  credentialRef: string;
  name: string;
  provider: string;
  maskedKey: string;
  enabled: boolean;
  isDefault: boolean;
  usage: {
    aiAgent: boolean;
    knowledgeEmbedding: boolean;
  };
};

export type AiAgentProductCredentialTestResult = {
  success: boolean;
  provider: string;
  message: string;
};
