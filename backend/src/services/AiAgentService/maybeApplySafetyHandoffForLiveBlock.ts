import Ticket from "../../models/Ticket";
import applyAiAgentHandoffToTicket from "./applyAiAgentHandoffToTicket";

export async function maybeApplySafetyHandoffForLiveBlock(input: {
  ticket: Ticket;
  companyId: number;
  errorCode: string;
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

  await applyAiAgentHandoffToTicket({
    ticket: input.ticket,
    companyId: input.companyId,
    reason,
    by: "ai_agent"
  });
}
