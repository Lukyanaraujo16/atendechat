import { Op } from "sequelize";
import Message from "../models/Message";
import AiAgentRuntimeLog from "../models/AiAgentRuntimeLog";
import Ticket from "../models/Ticket";
import {
  resolveTicketAutomationState,
  TicketAutomationState
} from "./ticketAutomationState";

async function loadAiEvidenceByTicketIds(
  companyId: number,
  ticketIds: number[]
): Promise<{
  outboundAi: Set<number>;
  liveRuntime: Set<number>;
}> {
  const outboundAi = new Set<number>();
  const liveRuntime = new Set<number>();
  if (ticketIds.length === 0) {
    return { outboundAi, liveRuntime };
  }

  const messages = await Message.findAll({
    where: {
      companyId,
      ticketId: { [Op.in]: ticketIds },
      messageOrigin: "ai_agent",
      fromMe: true
    },
    attributes: ["ticketId"],
    raw: true
  });
  for (const row of messages as Array<{ ticketId: number }>) {
    if (row.ticketId != null) outboundAi.add(Number(row.ticketId));
  }

  const logs = await AiAgentRuntimeLog.findAll({
    where: {
      companyId,
      ticketId: { [Op.in]: ticketIds },
      mode: "live",
      liveStatus: { [Op.in]: ["queued", "generated", "sending", "sent"] }
    },
    attributes: ["ticketId"],
    raw: true
  });
  for (const row of logs as Array<{ ticketId: number }>) {
    if (row.ticketId != null) liveRuntime.add(Number(row.ticketId));
  }

  return { outboundAi, liveRuntime };
}

export type TicketWithAutomationState = Ticket & TicketAutomationState;

export default async function enrichTicketsWithAutomationState(
  tickets: Ticket[],
  companyId: number
): Promise<TicketWithAutomationState[]> {
  if (!tickets.length) return [];

  const ticketIds = tickets.map((t) => t.id).filter((id) => id != null);
  const { outboundAi, liveRuntime } = await loadAiEvidenceByTicketIds(
    companyId,
    ticketIds
  );

  return tickets.map((ticket) => {
    const whatsapp = ticket.whatsapp;
    const aiAgentName =
      (whatsapp as { aiAgent?: { name?: string } })?.aiAgent?.name ?? null;
    const state = resolveTicketAutomationState({
      ticket,
      whatsapp,
      aiAgentName,
      hasAiAgentOutboundMessage: outboundAi.has(ticket.id),
      hasLiveRuntimeActivity: liveRuntime.has(ticket.id)
    });

    const plain =
      typeof (ticket as { toJSON?: () => Record<string, unknown> }).toJSON ===
      "function"
        ? (ticket as { toJSON: () => Record<string, unknown> }).toJSON()
        : { ...(ticket as unknown as Record<string, unknown>) };

    return Object.assign(plain, state) as unknown as TicketWithAutomationState;
  });
}
