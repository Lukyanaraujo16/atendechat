import AiAgent from "../../models/AiAgent";
import Ticket from "../../models/Ticket";
import executeAiAgentHandoffWithTransition from "./executeAiAgentHandoffWithTransition";
import { loadAiAgentProfileForRuntime } from "./resolveAiAgentBusinessPrompt";
import { logger } from "../../utils/logger";

export async function maybeApplySafetyHandoffForLiveBlock(input: {
  ticket: Ticket;
  companyId: number;
  errorCode: string;
  agent?: AiAgent | null;
  aiAgentRuntimeLogId?: number | null;
}): Promise<void> {
  if (input.ticket.aiAgentHandoffRequested === true) {
    return;
  }

  const reasonMap: Record<string, string> = {
    live_ticket_limit_reached: "live_ticket_limit_reached_handoff",
    live_generation_failed: "live_consecutive_failures_handoff"
  };

  const reason = reasonMap[input.errorCode];
  if (!reason) {
    return;
  }

  // Sem agente não há como assinar/enviar transição — não transferir silenciosamente.
  if (!input.agent) {
    logger.warn(
      {
        event: "ai_agent.handoff_failed",
        companyId: input.companyId,
        ticketId: input.ticket.id,
        reason,
        result: "missing_agent_for_transition"
      },
      "ai_agent.handoff_failed"
    );
    return;
  }

  const profile = await loadAiAgentProfileForRuntime({
    companyId: input.companyId,
    aiAgentId: input.agent.id
  });

  await executeAiAgentHandoffWithTransition({
    ticket: input.ticket,
    companyId: input.companyId,
    aiAgentId: input.agent.id,
    agentName: input.agent.name,
    aiAgentRuntimeLogId: input.aiAgentRuntimeLogId ?? null,
    reason,
    configuredHandoffMessage: input.agent.handoffMessage,
    tone: profile?.tone || "professional",
    modelCleanText: null,
    by: "ai_agent"
  });
}
