import {
  AiAgentNextAction,
  AiAgentProductAgentScope,
  AiAgentProductCheck,
  AiAgentProductCheckStatus,
  AiAgentProductMode,
  AiAgentProductReadiness,
  AgentProductStatus,
  AGENT_PRODUCT_STATUS_PRIORITY
} from "../../types/aiAgentProduct";
import { AiAgentRuntimeMode } from "../AiAgentService/aiAgentRuntimeMode";
import { resolveAiAgentProductAgentContext } from "./ResolveAiAgentProductContextService";
import type { AiAgentProductProviderCompatibility } from "./aiAgentProductProviderCapabilities";

export type AiAgentProductAgentSnapshot = {
  id: number;
  name: string;
  enabled: boolean;
  /**
   * true somente quando provider + credencial selecionada + modelo
   * estão comercialmente compatíveis (Hardening 2.3.2).
   */
  hasProvider: boolean;
  hasInstructions: boolean;
  /**
   * Pausa operacional/comercial explícita do agente (futuro).
   * Ticket.aiAgentPaused NÃO preenche este campo.
   * Sem sinal inequívoco, permanece false — status `paused` não é emitido.
   */
  explicitlyPaused?: boolean;
  /**
   * Detalhe de compatibilidade provider/credencial/modelo.
   * Ausente em snapshots legados de teste → deriva de hasProvider.
   */
  providerCompatibility?: AiAgentProductProviderCompatibility;
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

function compatibilityOf(
  agent: AiAgentProductAgentSnapshot | null
): AiAgentProductProviderCompatibility | null {
  if (!agent) return null;
  if (agent.providerCompatibility) return agent.providerCompatibility;
  // Fallback legado (testes 2.0): hasProvider booleano único
  const status: AiAgentProductCheckStatus = agent.hasProvider
    ? "complete"
    : "pending";
  return {
    ready: agent.hasProvider === true,
    hasConflict: false,
    providerStatus: status,
    credentialStatus: status,
    modelStatus: status,
    providerLabelKey: labelKeyForCheck("provider"),
    credentialLabelKey: labelKeyForCheck("credential"),
    modelLabelKey: labelKeyForCheck("model")
  };
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

function buildChecks(input: {
  enabledByPlan: boolean;
  accessibleByUser: boolean;
  agent: AiAgentProductAgentSnapshot | null;
  linked: AiAgentProductConnectionSnapshot[];
  mode: AiAgentProductMode;
  agentAmbiguous?: boolean;
}): AiAgentProductCheck[] {
  const {
    enabledByPlan,
    accessibleByUser,
    agent,
    linked,
    mode,
    agentAmbiguous
  } = input;

  const planStatus =
    !enabledByPlan || !accessibleByUser
      ? ("blocked" as const)
      : ("complete" as const);

  const agentStatus = agentAmbiguous
    ? ("blocked" as const)
    : agent
      ? ("complete" as const)
      : ("pending" as const);

  const compat = compatibilityOf(agent);

  const providerStatus: AiAgentProductCheckStatus = !agent
    ? "pending"
    : compat!.providerStatus;
  const credentialStatus: AiAgentProductCheckStatus = !agent
    ? "pending"
    : compat!.credentialStatus;
  const modelStatus: AiAgentProductCheckStatus = !agent
    ? "pending"
    : compat!.modelStatus;

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

  const providerReady =
    providerStatus === "complete" &&
    credentialStatus === "complete" &&
    modelStatus === "complete";

  let modeStatus: AiAgentProductCheck["status"] = "pending";
  if (mode === "live" || mode === "shadow") modeStatus = "complete";
  else if (mode === "paused") modeStatus = "warning";
  else if (agent && providerReady && agent.hasInstructions && linked.length > 0) {
    modeStatus = "pending";
  }

  return [
    { key: "plan", status: planStatus, labelKey: labelKeyForCheck("plan") },
    {
      key: "agent",
      status: agentStatus,
      labelKey: agentAmbiguous
        ? "aiAgentProduct.checks.agentAmbiguous"
        : labelKeyForCheck("agent")
    },
    {
      key: "provider",
      status: providerStatus,
      labelKey: compat?.providerLabelKey || labelKeyForCheck("provider")
    },
    {
      key: "credential",
      status: credentialStatus,
      labelKey: compat?.credentialLabelKey || labelKeyForCheck("credential")
    },
    {
      key: "model",
      status: modelStatus,
      labelKey: compat?.modelLabelKey || labelKeyForCheck("model")
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
    "credential",
    "model",
    "instructions",
    "connection"
  ];
  return required.every(key => {
    const c = checks.find(x => x.key === key);
    return c?.status === "complete";
  });
}

function hasConfigurationConflict(checks: AiAgentProductCheck[]): boolean {
  return checks.some(
    c =>
      (c.key === "provider" || c.key === "credential" || c.key === "model") &&
      c.status === "blocked"
  );
}

function resolveNextAction(input: {
  status: AgentProductStatus;
  checks: AiAgentProductCheck[];
  mode: AiAgentProductMode;
  agentAmbiguous?: boolean;
}): AiAgentNextAction {
  const { status, checks, mode, agentAmbiguous } = input;

  if (status === "unavailable") return "upgrade_plan";
  if (status === "not_created") return "create_agent";
  if (status === "paused") return "resume_agent";
  if (agentAmbiguous) return "configure_agent";

  if (status === "attention_required") {
    if (hasConfigurationConflict(checks)) return "resolve_conflict";
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
    { key: "credential", action: "configure_provider" },
    { key: "model", action: "configure_agent" },
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

  if (
    agent.enabled === false &&
    linked.some(c => technicalModeToCommercial(c.runtimeMode) !== "off")
  ) {
    return true;
  }

  const activeModes = new Set(
    linked
      .map(c => technicalModeToCommercial(c.runtimeMode))
      .filter(m => m !== "off")
  );
  if (activeModes.size > 1) {
    return true;
  }

  return false;
}

/**
 * Única fonte oficial de readiness comercial (Architecture Lock §12).
 * Resolução do agente: ResolveAiAgentProductContextService (Estratégia A).
 * Compatibilidade provider/credencial/modelo: Hardening 2.3.2.
 */
export function computeAiAgentProductReadiness(
  snapshot: AiAgentProductSnapshot
): {
  readiness: AiAgentProductReadiness;
  agent: AiAgentProductAgentSnapshot | null;
  linkedConnections: AiAgentProductConnectionSnapshot[];
  primaryConnection: AiAgentProductConnectionSnapshot | null;
  agentScope: AiAgentProductAgentScope;
  resolution: "not_created" | "resolved" | "ambiguous";
} {
  const resolvedCtx = resolveAiAgentProductAgentContext(snapshot.agents);
  const agentAmbiguous = resolvedCtx.resolution === "ambiguous";
  const agent =
    resolvedCtx.resolution === "resolved" ? resolvedCtx.agent : null;

  const linked = agent
    ? snapshot.connections.filter(c => c.aiAgentId === agent.id)
    : [];

  const mode = agentAmbiguous
    ? ("off" as AiAgentProductMode)
    : resolveAiAgentProductMode({
        agent,
        linkedConnections: linked
      });

  const checks = buildChecks({
    enabledByPlan: snapshot.enabledByPlan,
    accessibleByUser: snapshot.accessibleByUser,
    agent,
    linked,
    mode,
    agentAmbiguous
  });

  const setupComplete =
    snapshot.enabledByPlan &&
    snapshot.accessibleByUser &&
    !agentAmbiguous &&
    isSetupComplete(checks);

  let status: AgentProductStatus;

  if (!snapshot.enabledByPlan || !snapshot.accessibleByUser) {
    status = "unavailable";
  } else if (resolvedCtx.resolution === "not_created") {
    status = "not_created";
  } else if (agentAmbiguous) {
    status = "attention_required";
  } else if (hasConfigurationConflict(checks)) {
    // Configuração contraditória prevalece sobre setup_incomplete / ready
    status = "attention_required";
  } else if (!setupComplete) {
    status = "setup_incomplete";
  } else if (hasAttention({ setupComplete: true, mode, linked, agent })) {
    status = "attention_required";
  } else if (agent?.explicitlyPaused === true || mode === "paused") {
    status = "paused";
  } else if (mode === "live" || mode === "shadow") {
    status = "active";
  } else {
    status = "ready_to_activate";
  }

  const nextAction = resolveNextAction({
    status,
    checks,
    mode,
    agentAmbiguous
  });
  const ready =
    !agentAmbiguous &&
    (status === "ready_to_activate" || status === "active");

  const linkedOrdered = [...linked].sort((a, b) => Number(a.id) - Number(b.id));
  const primaryConnection =
    linkedOrdered.find(
      c => String(c.status || "").toUpperCase() === "CONNECTED"
    ) ||
    linkedOrdered[0] ||
    null;

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
    linkedConnections: linkedOrdered,
    primaryConnection,
    agentScope: resolvedCtx.agentScope,
    resolution: resolvedCtx.resolution
  };
}

export const AgentReadinessService = {
  compute: computeAiAgentProductReadiness
};

export default AgentReadinessService;
