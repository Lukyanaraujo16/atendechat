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

/** Automation Orchestrator Monitor (Fase IA 2.0). */
export const AUTOMATION_MONITOR_ROUTE_PATH = "/automation/monitor";

/**
 * Controla exibição da aba/menu do Agente de IA.
 * Manter `false` até a fase com página funcional + backend.
 */
export const AI_AGENT_UI_ENABLED = true;
