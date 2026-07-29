/**
 * Mapper comercial — Product API Agente de IA (Fases 2.0–2.2).
 * Não recalcula readiness; traduz status/mode/nextAction/checks para UI.
 */
import {
  AI_AGENT_SIMULATOR_ROUTE_PATH,
  AI_AGENT_WIZARD_ROUTE_PATH,
} from "../config/aiAgentFeature";

export const AI_AGENT_PRODUCT_STATUSES = [
  "not_created",
  "setup_incomplete",
  "ready_to_activate",
  "active",
  "paused",
  "attention_required",
  "unavailable",
];

export const AI_AGENT_PRODUCT_MODES = ["off", "shadow", "live", "paused"];

export const AI_AGENT_PRODUCT_NEXT_ACTIONS = [
  "upgrade_plan",
  "create_agent",
  "configure_agent",
  "configure_provider",
  "connect_whatsapp",
  "fix_connection",
  "resolve_conflict",
  "activate_shadow",
  "activate_live",
  "resume_agent",
  "none",
];

export const AI_AGENT_PRODUCT_COMMANDS = [
  "activate_shadow",
  "activate_live",
  "deactivate",
];

export const AI_AGENT_PRODUCT_CHECK_STATUSES = [
  "complete",
  "pending",
  "blocked",
  "warning",
];

/** resume_agent permanece adiado — sem pausa global no domínio. */
const DEFERRED_MUTATION_ACTIONS = new Set(["resume_agent"]);

const PRODUCT_MUTATION_COMMANDS = new Set([
  "activate_shadow",
  "activate_live",
]);

const STATUS_TONE = {
  unavailable: "neutral",
  not_created: "info",
  setup_incomplete: "warning",
  ready_to_activate: "success",
  active: "success",
  paused: "warning",
  attention_required: "danger",
};

export function normalizeAiAgentProductStatus(status) {
  if (AI_AGENT_PRODUCT_STATUSES.includes(status)) return status;
  return "unavailable";
}

export function normalizeAiAgentProductMode(mode) {
  if (AI_AGENT_PRODUCT_MODES.includes(mode)) return mode;
  return "off";
}

export function normalizeAiAgentNextAction(action) {
  if (AI_AGENT_PRODUCT_NEXT_ACTIONS.includes(action)) return action;
  return "none";
}

export function normalizeAiAgentProductCommand(command) {
  if (AI_AGENT_PRODUCT_COMMANDS.includes(command)) return command;
  return null;
}

export function normalizeAiAgentCheckStatus(status) {
  if (AI_AGENT_PRODUCT_CHECK_STATUSES.includes(status)) return status;
  return "pending";
}

export function mapAiAgentProductStatus(status) {
  const normalized = normalizeAiAgentProductStatus(status);
  return {
    status: normalized,
    labelKey: `aiAgentProduct.status.${normalized}`,
    descriptionKey: `aiAgentProduct.statusDescription.${normalized}`,
    tone: STATUS_TONE[normalized] || "neutral",
  };
}

export function mapAiAgentProductMode(mode) {
  const normalized = normalizeAiAgentProductMode(mode);
  return {
    mode: normalized,
    labelKey: `aiAgentProduct.mode.${normalized}`,
  };
}

export function mapAiAgentCheck(check) {
  const raw = check && typeof check === "object" ? check : {};
  const key = typeof raw.key === "string" ? raw.key : "unknown";
  const status = normalizeAiAgentCheckStatus(raw.status);
  return {
    key,
    status,
    labelKey:
      typeof raw.labelKey === "string" && raw.labelKey
        ? raw.labelKey
        : `aiAgentProduct.checks.${key}`,
    descriptionKey: `aiAgentProduct.checkDescription.${key}`,
  };
}

function wizardPath(agentId) {
  if (agentId != null && Number.isFinite(Number(agentId))) {
    return `${AI_AGENT_WIZARD_ROUTE_PATH}/${Number(agentId)}`;
  }
  return AI_AGENT_WIZARD_ROUTE_PATH;
}

function simulatorPath() {
  return AI_AGENT_SIMULATOR_ROUTE_PATH;
}

function commandActionBase(command) {
  return {
    type: command,
    command,
    labelKey: `aiAgentProduct.nextAction.${command}`,
    path: null,
    enabled: true,
    reasonKey: null,
    requiresConfirmation: true,
  };
}

/**
 * Resolve nextAction → label, route estática, command ou enabled.
 * Mutações activate_* usam Product API (command). resume_agent permanece desabilitado.
 */
export function mapAiAgentNextAction(action, context = {}) {
  const normalized = normalizeAiAgentNextAction(action);
  const agentId = context.agentId;
  const reviewPath = wizardPath(agentId);

  const base = {
    type: normalized,
    labelKey: `aiAgentProduct.nextAction.${normalized}`,
    path: null,
    enabled: false,
    reasonKey: null,
    command: null,
    requiresConfirmation: false,
  };

  switch (normalized) {
    case "upgrade_plan":
      return { ...base, path: "/financeiro", enabled: true };
    case "create_agent":
      return { ...base, path: AI_AGENT_WIZARD_ROUTE_PATH, enabled: true };
    case "configure_agent":
    case "configure_provider":
    case "resolve_conflict":
      return { ...base, path: reviewPath, enabled: true };
    case "connect_whatsapp":
    case "fix_connection":
      return { ...base, path: "/connections", enabled: true };
    case "activate_shadow":
    case "activate_live":
      return {
        ...base,
        ...commandActionBase(normalized),
      };
    case "resume_agent":
      return {
        ...base,
        path: null,
        enabled: false,
        reasonKey: "aiAgentProduct.nextAction.mutationDeferred",
        fallbackPath: reviewPath,
        fallbackLabelKey: "aiAgentProduct.nextAction.reviewConfig",
      };
    case "none":
    default:
      return { ...base, type: "none", path: null, enabled: false };
  }
}

/**
 * Comandos comerciais extras (modo ativo / ready_to_activate).
 * Não inclui o comando já coberto pelo nextAction principal.
 */
export function buildAiAgentCommercialCommands(summary) {
  const status = summary?.status;
  const mode = summary?.mode;
  const primary = summary?.nextAction?.command || summary?.nextAction?.type;
  const commands = [];

  const push = (command) => {
    if (!AI_AGENT_PRODUCT_COMMANDS.includes(command)) return;
    if (command === primary) return;
    commands.push({
      ...commandActionBase(command),
      id: `cmd_${command}`,
      labelKey:
        command === "deactivate"
          ? "aiAgentProduct.commands.deactivate"
          : `aiAgentProduct.nextAction.${command}`,
      destructive: command === "deactivate",
    });
  };

  if (status === "unavailable" || status === "not_created" || status === "paused") {
    return commands;
  }

  if (status === "ready_to_activate") {
    push("activate_shadow");
    push("activate_live");
    return commands;
  }

  // Ambíguo (2.2.2): sem mutações comerciais
  if (
    status === "attention_required" &&
    summary?.agentScope?.type === "ambiguous"
  ) {
    return commands;
  }

  if (status === "attention_required") {
    // Hardening 2.3.2: conflito provider/credencial/modelo → sem activate
    const nextType =
      summary?.nextAction?.type || summary?.nextAction?.command || primary;
    if (nextType === "resolve_conflict") {
      push("deactivate");
      return commands;
    }
    push("activate_shadow");
    push("activate_live");
    push("deactivate");
    return commands;
  }

  if (status === "active") {
    if (mode === "shadow") {
      push("activate_live");
      push("deactivate");
    } else if (mode === "live") {
      push("activate_shadow");
      push("deactivate");
    } else if (mode === "off") {
      push("activate_shadow");
      push("activate_live");
    }
  }

  return commands;
}

export function buildAiAgentSecondaryActions(summary) {
  const scopeType = summary?.agentScope?.type;
  const isAmbiguous = scopeType === "ambiguous";
  // Sem agentScope (payload legado/teste): usa agent.id se existir. Ambíguo nunca.
  const agentId =
    !isAmbiguous &&
    summary?.agent?.exists &&
    (scopeType === "single" || scopeType == null) &&
    summary.agent.id != null &&
    Number.isFinite(Number(summary.agent.id))
      ? Number(summary.agent.id)
      : null;
  const actions = [
    {
      id: "open_wizard",
      labelKey: "aiAgentProduct.secondary.openWizard",
      path: wizardPath(agentId),
      enabled: true,
    },
    {
      id: "open_connections",
      labelKey: "aiAgentProduct.secondary.openConnections",
      path: "/connections",
      enabled: true,
    },
  ];
  const sim = simulatorPath();
  actions.unshift({
    id: "open_simulator",
    labelKey: "aiAgentProduct.secondary.openSimulator",
    path: sim,
    enabled: true,
  });
  return actions;
}

/**
 * View-model do summary. ready/status/mode/checks vêm do backend.
 */
export function mapAiAgentProductSummary(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  const readiness = data.readiness || {};
  const status = normalizeAiAgentProductStatus(
    readiness.status || data.status
  );
  const mode = normalizeAiAgentProductMode(data.mode || readiness.mode);
  const agent = data.agent && typeof data.agent === "object"
    ? {
        exists: data.agent.exists === true,
        id: data.agent.id,
        name: data.agent.name,
        enabled: data.agent.enabled === true,
      }
    : { exists: false };
  const connection =
    data.connection && typeof data.connection === "object"
      ? {
          linked: data.connection.linked === true,
          name: data.connection.name,
          connected: data.connection.connected === true,
        }
      : { linked: false };

  const rawScope =
    data.connectionScope && typeof data.connectionScope === "object"
      ? data.connectionScope
      : {};
  const connectionScope = {
    type: "all_linked",
    count: Math.max(0, Number(rawScope.count) || 0),
    connectedCount: Math.max(0, Number(rawScope.connectedCount) || 0),
    disconnectedCount: Math.max(0, Number(rawScope.disconnectedCount) || 0),
    names: Array.isArray(rawScope.names)
      ? rawScope.names.map((n) => String(n || "").trim()).filter(Boolean)
      : [],
  };

  const rawAgentScope =
    data.agentScope && typeof data.agentScope === "object"
      ? data.agentScope
      : {};
  let agentScopeType = ["none", "single", "ambiguous"].includes(
    rawAgentScope.type
  )
    ? rawAgentScope.type
    : null;
  if (!agentScopeType) {
    if (status === "not_created" || status === "unavailable") {
      agentScopeType = "none";
    } else if (agent.exists && agent.id != null) {
      agentScopeType = "single";
    } else if (agent.exists) {
      agentScopeType = "ambiguous";
    } else {
      agentScopeType = "none";
    }
  }
  let agentScopeCount = Math.max(0, Number(rawAgentScope.count) || 0);
  if (agentScopeCount === 0) {
    if (agentScopeType === "single") agentScopeCount = 1;
    if (agentScopeType === "ambiguous") agentScopeCount = 2;
  }
  const agentScope = {
    type: agentScopeType,
    count: agentScopeCount,
  };

  const nextAction = mapAiAgentNextAction(readiness.nextAction, {
    agentId:
      agentScope.type === "single" && agent.exists ? agent.id : null,
  });

  const checks = Array.isArray(readiness.checks)
    ? readiness.checks.map(mapAiAgentCheck)
    : [];

  const mapped = {
    availability: {
      enabledByPlan: data.availability?.enabledByPlan === true,
      accessibleByUser: data.availability?.accessibleByUser === true,
    },
    status,
    mode,
    ready: readiness.ready === true,
    statusMeta: mapAiAgentProductStatus(status),
    modeMeta: mapAiAgentProductMode(mode),
    nextAction,
    checks,
    agent,
    connection,
    connectionScope,
    agentScope,
    secondaryActions: [],
    commercialCommands: [],
  };
  mapped.secondaryActions = buildAiAgentSecondaryActions(mapped);
  mapped.commercialCommands = buildAiAgentCommercialCommands(mapped);
  return mapped;
}

export function mapAiAgentProductConfiguration(raw) {
  if (!raw) return null;
  return {
    agentScope: raw.agentScope || null,
    configuration: raw.configuration || null,
    editableWhileActive: raw.editableWhileActive === true,
    summary: raw.summary ? mapAiAgentProductSummary(raw.summary) : null,
  };
}

/**
 * Normaliza providers comerciais da Product API (Hardening 2.3.1).
 * Não duplica allowlist — apenas normaliza o payload do backend.
 * Frontend NÃO calcula readiness.
 */
export function mapAiAgentProductConfigurationOptions(raw) {
  if (!raw || typeof raw !== "object") return null;
  const providers = Array.isArray(raw.providers)
    ? raw.providers.map((p) => ({
        value: String(p?.value || "").trim().toLowerCase(),
        label: String(p?.label || "").trim() || String(p?.value || ""),
        available: p?.available === true,
        unavailableReason:
          p?.unavailableReason != null ? String(p.unavailableReason) : null,
      }))
    : [];
  return {
    providers,
    credentials: Array.isArray(raw.credentials) ? raw.credentials : [],
    connections: Array.isArray(raw.connections) ? raw.connections : [],
  };
}

export function normalizeAiAgentProductProvider(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "openai" || v === "gemini") return v;
  if (!v) return null;
  return "unknown";
}

export function isDeferredMutationAction(actionType) {
  return DEFERRED_MUTATION_ACTIONS.has(actionType);
}

export function isProductMutationCommand(actionType) {
  return PRODUCT_MUTATION_COMMANDS.has(actionType) || actionType === "deactivate";
}

export function getAiAgentCommandConfirmKeys(command) {
  const normalized = normalizeAiAgentProductCommand(command);
  if (!normalized) {
    return {
      titleKey: "aiAgentProduct.confirm.unknown.title",
      bodyKey: "aiAgentProduct.confirm.unknown.body",
      confirmKey: "aiAgentProduct.confirm.unknown.confirm",
      destructive: false,
    };
  }
  return {
    titleKey: `aiAgentProduct.confirm.${normalized}.title`,
    bodyKey: `aiAgentProduct.confirm.${normalized}.body`,
    confirmKey: `aiAgentProduct.confirm.${normalized}.confirm`,
    destructive: normalized === "deactivate",
  };
}

/** Params de interpolação para confirmações (impacto Opção A). */
export function getAiAgentCommandConfirmParams(connectionScope) {
  const scope = connectionScope && typeof connectionScope === "object"
    ? connectionScope
    : {};
  const count = Math.max(0, Number(scope.count) || 0);
  const names = Array.isArray(scope.names)
    ? scope.names.map((n) => String(n || "").trim()).filter(Boolean)
    : [];
  return {
    count,
    names: names.join(", "),
    disconnectedCount: Math.max(0, Number(scope.disconnectedCount) || 0),
    connectedCount: Math.max(0, Number(scope.connectedCount) || 0),
  };
}
