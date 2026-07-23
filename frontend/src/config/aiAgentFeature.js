/** Chave estável no catálogo PlanFeatures (grupo automation). */
export const AI_AGENT_FEATURE_KEY = "automation.ai_agent";

/** Rota futura do módulo Agente de IA. */
export const AI_AGENT_ROUTE_PATH = "/ai-agent";

/** Wizard do Assistente Guiado. */
export const AI_AGENT_WIZARD_ROUTE_PATH = "/ai-agent/wizard";
export const AI_AGENT_WIZARD_EDIT_ROUTE_PATH = "/ai-agent/wizard/:agentId";

/** Simulador de conversa do atendente virtual. */
export const AI_AGENT_SIMULATOR_ROUTE_PATH = "/ai-agent/:agentId/simulator";

/** Analytics / Observabilidade / Aprendizado assistido (Fase IA 1.5.3). */
export const AI_AGENT_ANALYTICS_ROUTE_PATH = "/ai-agent/analytics";

/** Function Calling Shadow dashboard (Fase IA 2.1E). */
export const AI_AGENT_SHADOW_FC_ROUTE_PATH = "/ai-agent/shadow-fc";

/** Evidence Engine dashboard (Fase IA 2.1F). */
export const AUTOMATION_EVIDENCE_ROUTE_PATH = "/automation/evidence";

/** Live Rollout dashboard (Fase IA 2.2). */
export const AUTOMATION_LIVE_ROLLOUT_ROUTE_PATH = "/automation/live-rollout";

/** Cognitive Planning Engine (AI Agent V2.0). */
export const AUTOMATION_PLANNING_ROUTE_PATH = "/automation/planning";

/** Plan Evaluation Engine (AI Agent V2.1). */
export const AUTOMATION_PLAN_EVALUATION_ROUTE_PATH =
  "/automation/plan-evaluation";

/** Execution Orchestrator sessions (AI Agent V2.2). */
export const AUTOMATION_EXECUTION_SESSIONS_ROUTE_PATH =
  "/automation/execution-sessions";

/** Action Execution Engine (AI Agent V2.3). */
export const AUTOMATION_ACTION_EXECUTION_ROUTE_PATH =
  "/automation/action-execution";

/** Runtime Integration Layer (AI Agent V2.4). */
export const AUTOMATION_RUNTIME_INTEGRATION_ROUTE_PATH =
  "/automation/runtime-integration";

/** Execution Feedback Engine (AI Agent V2.5). */
export const AUTOMATION_EXECUTION_FEEDBACK_ROUTE_PATH =
  "/automation/execution-feedback";

/** Cognitive Memory Engine (AI Agent V2.6). */
export const AUTOMATION_COGNITIVE_MEMORY_ROUTE_PATH =
  "/automation/cognitive-memory";

/** MCP Runtime (AI Agent V2.7). */
export const AUTOMATION_MCP_RUNTIME_ROUTE_PATH = "/automation/mcp-runtime";
export const AUTOMATION_MCP_FEATURE_KEY = "automation.mcp";

/** Learning Engine (AI Agent V2.8). */
export const AUTOMATION_LEARNING_ENGINE_ROUTE_PATH =
  "/automation/learning-engine";
export const AUTOMATION_LEARNING_FEATURE_KEY = "automation.learning";

/** Multi-Agent Runtime (AI Agent V2.9). */
export const AUTOMATION_MULTI_AGENT_ROUTE_PATH = "/automation/multi-agent";
export const AUTOMATION_MULTI_AGENT_FEATURE_KEY = "automation.multi_agent";

/** AgentOS Security Wave 2 — feature flags oficiais. */
export const AGENTOS_FEATURE_KEYS = {
  ai: "automation.ai",
  memory: "automation.memory",
  learning: "automation.learning",
  mcp: "automation.mcp",
  multiAgent: "automation.multi_agent",
  runtime: "automation.runtime",
  replay: "automation.replay",
  monitor: "automation.monitor",
  dashboard: "automation.dashboard",
  tester: "automation.tester"
};

/** Automation Orchestrator Monitor (Fase IA 2.0). */
export const AUTOMATION_MONITOR_ROUTE_PATH = "/automation/monitor";

/** AgentOS Observability (AI Agent V2.10 Wave 3). */
export const AUTOMATION_OBSERVABILITY_ROUTE_PATH = "/automation/observability";

/** AgentOS Production Readiness (AI Agent V2.10 Wave 5). */
export const AUTOMATION_PRODUCTION_ROUTE_PATH = "/automation/production";
export const AUTOMATION_PRODUCTION_FEATURE_KEY = "automation.production";

/** Ferramentas IA / Tools foundation (Fase IA 2.1A). */
export const AUTOMATION_TOOLS_ROUTE_PATH = "/automation/tools";
export const AUTOMATION_AI_TOOLS_FEATURE_KEY = "automation.ai_tools";

/**
 * Controla exibição da aba/menu do Agente de IA.
 * Manter `false` até a fase com página funcional + backend.
 */
export const AI_AGENT_UI_ENABLED = true;
