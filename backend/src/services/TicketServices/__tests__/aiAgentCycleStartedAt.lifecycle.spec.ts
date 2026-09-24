/* eslint-disable import/first */
const showTicket = jest.fn();
jest.mock("../ShowTicketService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => showTicket(...a)
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) })
}));

jest.mock("../../../helpers/companyTicketSocket", () => ({
  toCompanyTicketAudience: () => ({ emit: jest.fn() })
}));

import PauseTicketAiAgentService from "../PauseTicketAiAgentService";
import ResumeTicketAiAgentService from "../ResumeTicketAiAgentService";
import applyAiAgentHandoffToTicket from "../../AiAgentService/applyAiAgentHandoffToTicket";

function ticketWithCycle(partial: Record<string, unknown> = {}) {
  const cycleStartedAt = new Date("2026-09-22T08:00:00.000Z");
  const ticket: Record<string, unknown> = {
    id: 11,
    companyId: 1,
    status: "pending",
    aiAgentCycleStartedAt: cycleStartedAt,
    aiAgentPaused: false,
    aiAgentHandoffRequested: false,
    update: jest.fn(async (data: Record<string, unknown>) => {
      Object.assign(ticket, data);
    }),
    ...partial
  };
  return ticket;
}

describe("aiAgentCycleStartedAt — pause/resume/handoff não reiniciam ciclo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pause não altera aiAgentCycleStartedAt", async () => {
    const cycleStartedAt = new Date("2026-09-22T08:00:00.000Z");
    const ticket = ticketWithCycle({ aiAgentCycleStartedAt: cycleStartedAt });
    showTicket.mockResolvedValue(ticket);

    await PauseTicketAiAgentService({ companyId: 1, ticketId: 11, userId: 9 });

    const payload = (ticket.update as jest.Mock).mock.calls[0][0];
    expect(payload).not.toHaveProperty("aiAgentCycleStartedAt");
    expect(ticket.aiAgentCycleStartedAt).toBe(cycleStartedAt);
  });

  it("resume não altera aiAgentCycleStartedAt", async () => {
    const cycleStartedAt = new Date("2026-09-22T08:00:00.000Z");
    const ticket = ticketWithCycle({
      aiAgentCycleStartedAt: cycleStartedAt,
      aiAgentPaused: true,
      aiAgentHandoffRequested: true
    });
    showTicket.mockResolvedValue(ticket);

    await ResumeTicketAiAgentService({ companyId: 1, ticketId: 11 });

    const payload = (ticket.update as jest.Mock).mock.calls[0][0];
    expect(payload).not.toHaveProperty("aiAgentCycleStartedAt");
    expect(ticket.aiAgentCycleStartedAt).toBe(cycleStartedAt);
  });

  it("handoff não altera aiAgentCycleStartedAt", async () => {
    const cycleStartedAt = new Date("2026-09-22T08:00:00.000Z");
    const ticket = ticketWithCycle({ aiAgentCycleStartedAt: cycleStartedAt });
    showTicket.mockResolvedValue(ticket);

    await applyAiAgentHandoffToTicket({
      ticket: ticket as never,
      companyId: 1,
      reason: "live_ticket_limit_reached_handoff",
      emitSocket: false
    });

    const payload = (ticket.update as jest.Mock).mock.calls[0][0];
    expect(payload).not.toHaveProperty("aiAgentCycleStartedAt");
    expect(ticket.aiAgentCycleStartedAt).toBe(cycleStartedAt);
    expect(ticket.aiAgentHandoffRequested).toBe(true);
  });
});
