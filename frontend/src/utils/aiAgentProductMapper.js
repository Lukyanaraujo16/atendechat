/**
 * Mapper comercial — Product API Agente de IA (Fases 2.0 / 2.1).
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

export const AI_AGENT_PRODUCT_CHECK_STATUSES = [
  "complete",
  "pending",
  "blocked",
  "warning",
];

/** Mutações comerciais ainda sem Product API segura — Abordagem A (Fase 2.1). */
const DEFERRED_MUTATION_ACTIONS = new Set([
  "activate_shadow",
  "activate_live",
  "resume_agent",
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

function simulatorPath(agentId) {
  if (agentId == null || !Number.isFinite(Number(agentId))) return null;
  return AI_AGENT_SIMULATOR_ROUTE_PATH.replace(":agentId", String(agentId));
}

/**
 * Resolve nextAction → label, route estática, enabled.
 * Não aceita URL do backend. Mutações activate/resume ficam desabilitadas (Abordagem A).
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

export function buildAiAgentSecondaryActions(summary) {
  const agentId = summary?.agent?.exists ? summary.agent.id : null;
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
  const sim = simulatorPath(agentId);
  if (sim) {
    actions.unshift({
      id: "open_simulator",
      labelKey: "aiAgentProduct.secondary.openSimulator",
      path: sim,
      enabled: true,
    });
  }
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

  const nextAction = mapAiAgentNextAction(readiness.nextAction, {
    agentId: agent.exists ? agent.id : null,
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
    secondaryActions: [],
  };
  mapped.secondaryActions = buildAiAgentSecondaryActions(mapped);
  return mapped;
}

export function isDeferredMutationAction(actionType) {
  return DEFERRED_MUTATION_ACTIONS.has(actionType);
}
