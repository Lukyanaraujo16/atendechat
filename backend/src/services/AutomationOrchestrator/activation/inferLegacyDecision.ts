import { AutomationIntent } from "../../../config/automationOrchestratorConstants";
import { ExecutionContext } from "../types";

export type LegacyDecision = {
  legacyIntent: AutomationIntent;
  legacyHandler: string;
};

/**
 * Infere a decisão que o legado tomaria a partir das flags do contexto.
 */
export function inferLegacyDecision(ctx: ExecutionContext): LegacyDecision {
  if (
    ctx.ticket.userId != null ||
    ctx.ticket.aiAgentHandoffRequested === true
  ) {
    return { legacyIntent: "human", legacyHandler: "HumanAssumed" };
  }

  if (ctx.integrationState?.active === true) {
    return { legacyIntent: "integration", legacyHandler: "Integration" };
  }

  if (ctx.flowState?.active === true) {
    return { legacyIntent: "flow", legacyHandler: "FlowBuilder" };
  }

  if (ctx.chatbotState?.active === true || ctx.ticket.chatbot === true) {
    return { legacyIntent: "chatbot", legacyHandler: "Chatbot" };
  }

  const runtimeMode = String(ctx.metadata?.runtimeMode || "");
  if (
    (runtimeMode === "live" || runtimeMode === "shadow") &&
    ctx.aiAgent != null
  ) {
    return { legacyIntent: "live_agent", legacyHandler: "AiAgent" };
  }

  return { legacyIntent: "unknown", legacyHandler: "Unknown" };
}

export default inferLegacyDecision;
