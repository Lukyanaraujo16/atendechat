import {
  AiAgentNextAction,
  AiAgentProductCheck,
  AiAgentProductMode,
  AiAgentProductReadiness,
  AgentProductStatus,
  AGENT_PRODUCT_STATUS_PRIORITY
} from "../../types/aiAgentProduct";
import { AiAgentRuntimeMode } from "../AiAgentService/aiAgentRuntimeMode";

export type AiAgentProductAgentSnapshot = {
  id: number;
  name: string;
  enabled: boolean;
  hasProvider: boolean;
  hasInstructions: boolean;
  /**
   * Pausa operacional/comercial explícita do agente (futuro).
   * Ticket.aiAgentPaused NÃO preenche este campo.
   * Sem sinal inequívoco, permanece false — status `paused` não é emitido.
   */
  explicitlyPaused?: boolean;
};

export type AiAgentProductConnectionSnapshot = {
  id: number;
  name: string;
  status: string;
  aiAgentId: number | null;
  runtimeMode: AiAgentRuntimeMode;
};

export type AiAgentProductSnapshot = {
  enabledByPlan: boolean;
  accessibleByUser: boolean;
  agents: AiAgentProductAgentSnapshot[];
  connections: AiAgentProductConnectionSnapshot[];
};

function labelKeyForCheck(key: string): string {
  return `aiAgentProduct.checks.${key}`;
}

/**
 * Tradução comercial do runtime mode da conexão.
 * - live → live (ativação automática)
 * - shadow → shadow (ativação acompanhada / Shadow Mode)
 * - dry_run → shadow comercial como observação legada (NÃO é o pipeline Shadow técnico;
 *   AiAgentShadowService exige aiAgentMode === "shadow")
 * - disabled → off
 */
export function technicalModeToCommercial(
  mode: AiAgentRuntimeMode
): "off" | "shadow" | "live" {
  if (mode === "live") return "live";
  if (mode === "shadow" || mode === "dry_run") return "shadow";
  return "off";
}

/**
 * Modo comercial agregado.
 * Prioridade: explicitPaused > live > shadow (incl. dry_run) > off
 * agent.enabled=false NÃO implica modo paused.
 */
export function resolveAiAgentProductMode(input: {
  agent: AiAgentProductAgentSnapshot | null;
  linkedConnections: AiAgentProductConnectionSnapshot[];
}): AiAgentProductMode {
  const { agent, linkedConnections } = input;
  if (agent?.explicitlyPaused === true) {
    return "paused";
  }

  let hasLive = false;
  let hasShadow = false;
  for (const c of linkedConnections) {
    const m = technicalModeToCommercial(c.runtimeMode);
    if (m === "live") hasLive = true;
    if (m === "shadow") hasShadow = true;
  }
  if (hasLive) return "live";
  if (hasShadow) return "shadow";
  return "off";
}

function pickPrimaryAgent(
  agents: AiAgentProductAgentSnapshot[]
): AiAgentProductAgentSnapshot | null {
  if (!agents.length) return null;
  const enabled = agents.find(a => a.enabled);
  return enabled || agents[0];
}

function buildChecks(input: {
  enabledByPlan: boolean;
  accessibleByUser: boolean;
  agent: AiAgentProductAgentSnapshot | null;
  linked: AiAgentProductConnectionSnapshot[];
  mode: AiAgentProductMode;
}): AiAgentProductCheck[] {
  const { enabledByPlan, accessibleByUser, agent, linked, mode } = input;

  const planStatus =
    !enabledByPlan || !accessibleByUser
      ? ("blocked" as const)
      : ("complete" as const);

  const agentStatus = agent ? ("complete" as const) : ("pending" as const);

  const providerStatus = !agent
    ? ("pending" as const)
    : agent.hasProvider
      ? ("complete" as const)
      : ("pending" as const);

  const instructionsStatus = !agent
    ? ("pending" as const)
    : agent.hasInstructions
      ? ("complete" as const)
      : ("pending" as const);

  const connectionStatus = !agent
    ? ("pending" as const)
    : linked.length > 0
      ? ("complete" as const)
      : ("pending" as const);

  let modeStatus: AiAgentProductCheck["status"] = "pending";
  if (mode === "live" || mode === "shadow") modeStatus = "complete";
  else if (mode === "paused") modeStatus = "warning";
  else if (
    agent &&
    agent.hasProvider &&
    agent.hasInstructions &&
    linked.length > 0
  ) {
    modeStatus = "pending";
  }

  return [
    { key: "plan", status: planStatus, labelKey: labelKeyForCheck("plan") },
    { key: "agent", status: agentStatus, labelKey: labelKeyForCheck("agent") },
    {
      key: "provider",
      status: providerStatus,
      labelKey: labelKeyForCheck("provider")
    },
    {
      key: "instructions",
      status: instructionsStatus,
      labelKey: labelKeyForCheck("instructions")
    },
    {
      key: "connection",
      status: connectionStatus,
      labelKey: labelKeyForCheck("connection")
    },
    { key: "mode", status: modeStatus, labelKey: labelKeyForCheck("mode") }
  ];
}

function isSetupComplete(checks: AiAgentProductCheck[]): boolean {
  const required: Array<AiAgentProductCheck["key"]> = [
    "plan",
    "agent",
    "provider",
    "instructions",
    "connection"
  ];
  return required.every(key => {
    const c = checks.find(x => x.key === key);
    return c?.status === "complete";
  });
}

function resolveNextAction(input: {
  status: AgentProductStatus;
  checks: AiAgentProductCheck[];
  mode: AiAgentProductMode;
}): AiAgentNextAction {
  const { status, checks, mode } = input;

  if (status === "unavailable") return "upgrade_plan";
  if (status === "not_created") return "create_agent";
  if (status === "paused") return "resume_agent";
  if (status === "attention_required") {
    const conn = checks.find(c => c.key === "connection");
    if (conn && conn.status !== "complete") return "connect_whatsapp";
    return "fix_connection";
  }
  if (status === "ready_to_activate") return "activate_shadow";
  if (status === "active") return "none";

  const order: Array<{
    key: AiAgentProductCheck["key"];
    action: AiAgentNextAction;
  }> = [
    { key: "agent", action: "create_agent" },
    { key: "provider", action: "configure_provider" },
    { key: "instructions", action: "configure_agent" },
    { key: "connection", action: "connect_whatsapp" }
  ];
  for (const item of order) {
    const c = checks.find(x => x.key === item.key);
    if (c && c.status !== "complete") return item.action;
  }
  if (mode === "off") return "activate_shadow";
  return "configure_agent";
}

function hasAttention(input: {
  setupComplete: boolean;
  mode: AiAgentProductMode;
  linked: AiAgentProductConnectionSnapshot[];
  agent: AiAgentProductAgentSnapshot | null;
}): boolean {
  const { setupComplete, mode, linked, agent } = input;
  if (!setupComplete || !agent) return false;

  if (mode === "live" || mode === "shadow") {
    const anyConnected = linked.some(
      c => String(c.status || "").toUpperCase() === "CONNECTED"
    );
    if (!anyConnected) return true;
  }

  // Conexão em modo ativo com agente desligado — inconsistência estrutural
  if (
    agent.enabled === false &&
    linked.some(c => technicalModeToCommercial(c.runtimeMode) !== "off")
  ) {
    return true;
  }

  return false;
}

/**
 * Única fonte oficial de readiness comercial (Architecture Lock §12).
 *
 * Prioridade determinística (AGENT_PRODUCT_STATUS_PRIORITY):
 * unavailable → not_created → setup_incomplete → attention_required →
 * paused (só explicitPaused) → active → ready_to_activate
 */
export function computeAiAgentProductReadiness(
  snapshot: AiAgentProductSnapshot
): {
  readiness: AiAgentProductReadiness;
  agent: AiAgentProductAgentSnapshot | null;
  linkedConnections: AiAgentProductConnectionSnapshot[];
  primaryConnection: AiAgentProductConnectionSnapshot | null;
} {
  const agent = pickPrimaryAgent(snapshot.agents);
  const linked = agent
    ? snapshot.connections.filter(c => c.aiAgentId === agent.id)
    : [];

  const mode = resolveAiAgentProductMode({
    agent,
    linkedConnections: linked
  });

  const checks = buildChecks({
    enabledByPlan: snapshot.enabledByPlan,
    accessibleByUser: snapshot.accessibleByUser,
    agent,
    linked,
    mode
  });

  const setupComplete =
    snapshot.enabledByPlan &&
    snapshot.accessibleByUser &&
    isSetupComplete(checks);

  let status: AgentProductStatus;

  if (!snapshot.enabledByPlan || !snapshot.accessibleByUser) {
    status = "unavailable";
  } else if (!agent) {
    status = "not_created";
  } else if (!setupComplete) {
    status = "setup_incomplete";
  } else if (hasAttention({ setupComplete: true, mode, linked, agent })) {
    status = "attention_required";
  } else if (agent.explicitlyPaused === true || mode === "paused") {
    status = "paused";
  } else if (mode === "live" || mode === "shadow") {
    status = "active";
  } else {
    // Setup completo + modo off — inclui enabled=false sem sinal de pausa
    // (não há histórico de “já ativou”; enabled sozinho ≠ paused)
    status = "ready_to_activate";
  }

  const nextAction = resolveNextAction({ status, checks, mode });
  const ready = status === "ready_to_activate" || status === "active";

  const primaryConnection =
    linked.find(c => String(c.status || "").toUpperCase() === "CONNECTED") ||
    linked[0] ||
    null;

  // Invariante: prioridade numérica coerente com o ramo escolhido
  void AGENT_PRODUCT_STATUS_PRIORITY[status];

  return {
    readiness: {
      ready,
      status,
      mode,
      nextAction,
      checks
    },
    agent,
    linkedConnections: linked,
    primaryConnection
  };
}

export const AgentReadinessService = {
  compute: computeAiAgentProductReadiness
};

export default AgentReadinessService;
