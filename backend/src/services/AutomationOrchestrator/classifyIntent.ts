import { AutomationIntent } from "../../config/automationOrchestratorConstants";
import { ExecutionContext } from "./types";

export type ClassifyIntentResult = {
  intent: AutomationIntent;
  reason: string;
};

function isLiveOrShadowRuntime(metadata: Record<string, unknown>): boolean {
  const mode = String(
    metadata.runtimeMode ?? metadata.aiAgentRuntimeMode ?? ""
  ).toLowerCase();
  if (mode === "live" || mode === "shadow") return true;
  if (metadata.aiAgentRuntimeLive === true) return true;
  if (metadata.aiAgentRuntimeShadow === true) return true;
  return false;
}

/**
 * Classificação determinística por prioridade de flags do contexto.
 */
export function classifyIntent(ctx: ExecutionContext): ClassifyIntentResult {
  if (
    ctx.ticket.userId != null ||
    ctx.ticket.aiAgentHandoffRequested === true
  ) {
    return {
      intent: "human",
      reason:
        ctx.ticket.userId != null
          ? "ticket_assigned_to_user"
          : "handoff_requested"
    };
  }

  if (ctx.integrationState.active) {
    return { intent: "integration", reason: "integration_active" };
  }

  if (ctx.flowState.active) {
    return {
      intent: "flow",
      reason: ctx.flowState.reason || "flow_active"
    };
  }

  if (ctx.chatbotState.active) {
    return { intent: "chatbot", reason: "chatbot_active" };
  }

  const agentEnabled =
    ctx.aiAgent != null &&
    (ctx.aiAgent.enabled === true || ctx.aiAgent.enabled == null);

  if (agentEnabled && isLiveOrShadowRuntime(ctx.metadata)) {
    return { intent: "live_agent", reason: "ai_agent_live_or_shadow" };
  }

  if (ctx.aiAgent != null) {
    if (ctx.currentMessage.hasText || agentEnabled) {
      return { intent: "knowledge", reason: "ai_agent_available" };
    }
    return { intent: "knowledge", reason: "ai_agent_present" };
  }

  return { intent: "unknown", reason: "no_automation_match" };
}

export default classifyIntent;
