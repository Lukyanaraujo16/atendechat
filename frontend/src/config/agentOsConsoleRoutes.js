/**
 * Rotas do Console Técnico / AgentOS (Fase 1.3).
 * Contrato: docs/ai-agent-v1.1/AGENTOS_ROUTE_MATRIX.md
 */
import {
  AI_AGENT_ANALYTICS_ROUTE_PATH,
  AI_AGENT_SHADOW_FC_ROUTE_PATH,
  AUTOMATION_ACTION_EXECUTION_ROUTE_PATH,
  AUTOMATION_COGNITIVE_MEMORY_ROUTE_PATH,
  AUTOMATION_EVIDENCE_ROUTE_PATH,
  AUTOMATION_EXECUTION_FEEDBACK_ROUTE_PATH,
  AUTOMATION_EXECUTION_SESSIONS_ROUTE_PATH,
  AUTOMATION_LEARNING_ENGINE_ROUTE_PATH,
  AUTOMATION_LIVE_ROLLOUT_ROUTE_PATH,
  AUTOMATION_MCP_RUNTIME_ROUTE_PATH,
  AUTOMATION_MONITOR_ROUTE_PATH,
  AUTOMATION_MULTI_AGENT_ROUTE_PATH,
  AUTOMATION_OBSERVABILITY_ROUTE_PATH,
  AUTOMATION_PLAN_EVALUATION_ROUTE_PATH,
  AUTOMATION_PLANNING_ROUTE_PATH,
  AUTOMATION_PRODUCTION_ROUTE_PATH,
  AUTOMATION_RUNTIME_INTEGRATION_ROUTE_PATH,
  AUTOMATION_TOOLS_ROUTE_PATH,
} from "./aiAgentFeature";

export const AGENTOS_CONSOLE_VIEW_PERMISSION = "agentOS.console.view";

export const TECHNICAL_CONSOLE_ROOT_PATH = "/technical-console/agentos";

/**
 * Pares alias antigo → canônico (sem inventar módulos inexistentes).
 * @type {{ legacyPath: string, canonicalPath: string, pageKey: string }[]}
 */
export const AGENTOS_TECHNICAL_ROUTE_ENTRIES = [
  {
    legacyPath: AUTOMATION_MONITOR_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/monitor`,
    pageKey: "monitor",
  },
  {
    legacyPath: AUTOMATION_OBSERVABILITY_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/observability`,
    pageKey: "observability",
  },
  {
    legacyPath: AUTOMATION_PLANNING_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/planning`,
    pageKey: "planning",
  },
  {
    legacyPath: AUTOMATION_PLAN_EVALUATION_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/evaluation`,
    pageKey: "evaluation",
  },
  {
    legacyPath: AUTOMATION_EXECUTION_SESSIONS_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/execution-sessions`,
    pageKey: "execution-sessions",
  },
  {
    legacyPath: AUTOMATION_RUNTIME_INTEGRATION_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/runtime`,
    pageKey: "runtime",
  },
  {
    legacyPath: AUTOMATION_ACTION_EXECUTION_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/actions`,
    pageKey: "actions",
  },
  {
    legacyPath: AUTOMATION_EXECUTION_FEEDBACK_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/feedback`,
    pageKey: "feedback",
  },
  {
    legacyPath: AUTOMATION_COGNITIVE_MEMORY_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/memory`,
    pageKey: "memory",
  },
  {
    legacyPath: AUTOMATION_MCP_RUNTIME_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/mcp`,
    pageKey: "mcp",
  },
  {
    legacyPath: AUTOMATION_LEARNING_ENGINE_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/learning`,
    pageKey: "learning",
  },
  {
    legacyPath: AUTOMATION_MULTI_AGENT_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/multi-agent`,
    pageKey: "multi-agent",
  },
  {
    legacyPath: AUTOMATION_EVIDENCE_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/evidence`,
    pageKey: "evidence",
  },
  {
    legacyPath: AUTOMATION_LIVE_ROLLOUT_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/rollout`,
    pageKey: "rollout",
  },
  {
    legacyPath: AUTOMATION_PRODUCTION_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/production`,
    pageKey: "production",
  },
  {
    legacyPath: AUTOMATION_TOOLS_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/tools`,
    pageKey: "tools",
  },
  {
    legacyPath: AI_AGENT_ANALYTICS_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/analytics`,
    pageKey: "analytics",
  },
  {
    legacyPath: AI_AGENT_SHADOW_FC_ROUTE_PATH,
    canonicalPath: `${TECHNICAL_CONSOLE_ROOT_PATH}/shadow-fc`,
    pageKey: "shadow-fc",
  },
];

export function getAgentOsCanonicalPath(legacyOrCanonical) {
  if (!legacyOrCanonical) return null;
  if (legacyOrCanonical === TECHNICAL_CONSOLE_ROOT_PATH) {
    return TECHNICAL_CONSOLE_ROOT_PATH;
  }
  const hit = AGENTOS_TECHNICAL_ROUTE_ENTRIES.find(
    (e) =>
      e.legacyPath === legacyOrCanonical ||
      e.canonicalPath === legacyOrCanonical
  );
  return hit ? hit.canonicalPath : null;
}

/** Paths registrados no React Router (root + canônicos + aliases). */
export function getAgentOsRouterPaths() {
  const paths = [TECHNICAL_CONSOLE_ROOT_PATH];
  AGENTOS_TECHNICAL_ROUTE_ENTRIES.forEach((e) => {
    paths.push(e.canonicalPath);
    paths.push(e.legacyPath);
  });
  return paths;
}

export function isAgentOsTechnicalPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  if (
    pathname === TECHNICAL_CONSOLE_ROOT_PATH ||
    pathname.startsWith(`${TECHNICAL_CONSOLE_ROOT_PATH}/`)
  ) {
    return true;
  }
  return AGENTOS_TECHNICAL_ROUTE_ENTRIES.some((e) => e.legacyPath === pathname);
}
