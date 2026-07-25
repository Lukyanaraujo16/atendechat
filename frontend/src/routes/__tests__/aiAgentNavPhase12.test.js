/**
 * Fase 1.2 — contratos estáticos de navegação comercial (sem DOM).
 */
import {
  AI_AGENT_ROUTE_PATH,
  AI_AGENT_WIZARD_ROUTE_PATH,
  AI_AGENT_ANALYTICS_ROUTE_PATH,
  AI_AGENT_SHADOW_FC_ROUTE_PATH,
  AUTOMATION_MONITOR_ROUTE_PATH,
  AUTOMATION_OBSERVABILITY_ROUTE_PATH,
  AUTOMATION_PLANNING_ROUTE_PATH,
  AUTOMATION_MCP_RUNTIME_ROUTE_PATH,
  AUTOMATION_LEARNING_ENGINE_ROUTE_PATH,
  AUTOMATION_MULTI_AGENT_ROUTE_PATH,
} from "../../config/aiAgentFeature";
import { isCommercialAutomationsPath } from "../../utils/commercialAutomationsNav";

const TECHNICAL_PATHS_HIDDEN_FROM_COMMERCIAL_NAV = [
  AUTOMATION_MONITOR_ROUTE_PATH,
  AUTOMATION_OBSERVABILITY_ROUTE_PATH,
  AUTOMATION_PLANNING_ROUTE_PATH,
  AUTOMATION_MCP_RUNTIME_ROUTE_PATH,
  AUTOMATION_LEARNING_ENGINE_ROUTE_PATH,
  AUTOMATION_MULTI_AGENT_ROUTE_PATH,
  AI_AGENT_SHADOW_FC_ROUTE_PATH,
  AI_AGENT_ANALYTICS_ROUTE_PATH,
];

describe("Fase 1.2 — navegação comercial Agente de IA / Automações", () => {
  it("rota canônica do Agente de IA permanece /ai-agent", () => {
    expect(AI_AGENT_ROUTE_PATH).toBe("/ai-agent");
  });

  it("wizard e analytics são estáticos sob /ai-agent", () => {
    expect(AI_AGENT_WIZARD_ROUTE_PATH).toBe("/ai-agent/wizard");
    expect(AI_AGENT_ANALYTICS_ROUTE_PATH).toBe("/ai-agent/analytics");
    expect(AI_AGENT_SHADOW_FC_ROUTE_PATH).toBe("/ai-agent/shadow-fc");
  });

  it("Automações comerciais não inclui quick-messages, prompts nem ai-agent", () => {
    expect(isCommercialAutomationsPath("/quick-messages")).toBe(false);
    expect(isCommercialAutomationsPath("/prompts")).toBe(false);
    expect(isCommercialAutomationsPath("/ai-agent")).toBe(false);
  });

  it("paths AgentOS não são paths comerciais de Automações", () => {
    TECHNICAL_PATHS_HIDDEN_FROM_COMMERCIAL_NAV.forEach((p) => {
      expect(isCommercialAutomationsPath(p)).toBe(false);
    });
  });

  it("classifica paths comerciais vs demais", () => {
    expect(isCommercialAutomationsPath("/flowbuilders")).toBe(true);
    expect(isCommercialAutomationsPath("/flowbuilder/12")).toBe(true);
    expect(isCommercialAutomationsPath("/phrase-lists")).toBe(true);
    expect(isCommercialAutomationsPath("/queue-integration")).toBe(true);
    expect(isCommercialAutomationsPath("/automation/planning")).toBe(false);
  });
});
