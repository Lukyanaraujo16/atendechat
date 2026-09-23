/* eslint-disable import/first */
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("../../../utils/flowBuilderDebug", () => ({
  isFlowBuilderDebugEnabled: () => false
}));

const showTicket = jest.fn();
jest.mock("../ShowTicketService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => showTicket(...a)
}));

const findOrCreateTracking = jest.fn();
jest.mock("../FindOrCreateATicketTrakingService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => findOrCreateTracking(...a)
}));

const assertRecreation = jest.fn();
jest.mock("../TicketDeletionGuardService", () => ({
  assertTicketRecreationAllowed: (...a: unknown[]) => assertRecreation(...a)
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  parseTicketDataWebhook: (data: unknown) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return { ...(data as Record<string, unknown>) };
  }
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { name: "Contact" }
}));

import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import FindOrCreateTicketService from "../FindOrCreateTicketService";

const findOne = Ticket.findOne as jest.Mock;
const createTicket = Ticket.create as jest.Mock;
const whatsappFind = Whatsapp.findOne as jest.Mock;

function contact(partial: Record<string, unknown> = {}) {
  return {
    id: 7,
    number: "5511999998888",
    companyId: 1,
    ...partial
  } as never;
}

function makeTicket(partial: Record<string, unknown> = {}) {
  const ticket: Record<string, unknown> = {
    id: 11,
    status: "closed",
    isGroup: false,
    companyId: 1,
    whatsappId: 3,
    contactId: 7,
    queueId: 4,
    userId: 9,
    chatbot: null,
    queueOptionId: 2,
    useIntegration: true,
    integrationId: 1,
    promptId: 8,
    flowStopped: "1",
    lastFlowId: 55,
    hashFlowId: "h",
    flowWebhook: true,
    amountUsedBotQueues: 3,
    typebotSessionId: "tb",
    typebotStatus: true,
    aiAgentPaused: false,
    aiAgentPausedAt: null,
    aiAgentPausedBy: null,
    aiAgentHandoffRequested: false,
    aiAgentHandoffRequestedAt: null,
    aiAgentHandoffReason: null,
    aiAgentHandoffBy: null,
    dataWebhook: { remoteJid: "5511999998888@s.whatsapp.net" },
    update: jest.fn(async (data: Record<string, unknown>) => {
      Object.assign(ticket, data);
    }),
    ...partial
  };
  return ticket;
}

function cycleResetPayload(ticket: Record<string, unknown>) {
  const updates = (ticket.update as jest.Mock).mock.calls.map(
    call => call[0] as Record<string, unknown>
  );
  return updates.find(
    payload =>
      payload.flowStopped === null &&
      payload.lastFlowId === null &&
      payload.flowWebhook === false
  );
}

describe("FindOrCreateTicketService — ciclo inbound closed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    whatsappFind.mockResolvedValue({ id: 3 });
    assertRecreation.mockResolvedValue(undefined);
    findOrCreateTracking.mockResolvedValue({
      update: jest.fn()
    });
  });

  it("privado closed reutiliza o mesmo ticket e reabre como pending", async () => {
    const ticket = makeTicket();
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);

    expect(createTicket).not.toHaveBeenCalled();
    expect(result.id).toBe(11);
    expect(ticket.status).toBe("pending");
    expect(ticket.status).not.toBe("closed");
    expect(ticket.queueId).toBeNull();
    expect(ticket.userId).toBeNull();
    expect(ticket.chatbot).toBe(false);
    expect(ticket.flowStopped).toBeNull();
    expect(ticket.lastFlowId).toBeNull();
    expect(ticket.flowWebhook).toBe(false);
    expect(ticket.hashFlowId).toBeNull();
    expect(ticket.useIntegration).toBe(false);
    expect(ticket.integrationId).toBeNull();

    const reset = cycleResetPayload(ticket);
    expect(reset).toMatchObject({
      status: "pending",
      queueId: null,
      userId: null,
      chatbot: false,
      flowStopped: null,
      lastFlowId: null,
      flowWebhook: false
    });
    expect(reset?.dataWebhook).toEqual({
      remoteJid: "5511999998888@s.whatsapp.net"
    });
  });

  it("privado closed não permanece closed", async () => {
    const ticket = makeTicket({ id: 11, status: "closed" });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(result.status).toBe("pending");
    expect(result.id).toBe(11);
  });

  it("grupo closed não é forçado para pending", async () => {
    const groupContact = contact({
      id: 90,
      number: "120363111222333",
      isGroup: true
    });
    const ticket = makeTicket({
      id: 20,
      contactId: 90,
      isGroup: true,
      status: "closed"
    });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(
      contact(),
      3,
      1,
      1,
      groupContact
    );

    expect(createTicket).not.toHaveBeenCalled();
    expect(result.id).toBe(20);
    expect(result.status).toBe("closed");
    const reset = cycleResetPayload(ticket);
    expect(reset).toBeDefined();
    expect(reset).not.toHaveProperty("status");
    expect(reset).toMatchObject({
      queueId: null,
      userId: null,
      chatbot: false,
      flowStopped: null,
      lastFlowId: null,
      flowWebhook: false
    });
  });

  it("ticket privado já pending permanece pending sem novo registro", async () => {
    const ticket = makeTicket({
      status: "pending",
      chatbot: false,
      queueId: null,
      userId: null,
      flowStopped: null,
      lastFlowId: null,
      flowWebhook: false
    });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(result.id).toBe(11);
    expect(result.status).toBe("pending");
    expect(createTicket).not.toHaveBeenCalled();
    expect(cycleResetPayload(ticket)).toBeUndefined();
  });

  it("ticket privado já open permanece open", async () => {
    const ticket = makeTicket({
      status: "open",
      userId: 9,
      queueId: 4,
      chatbot: false
    });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(result.id).toBe(11);
    expect(result.status).toBe("open");
    expect(result.userId).toBe(9);
    expect(createTicket).not.toHaveBeenCalled();
    expect(cycleResetPayload(ticket)).toBeUndefined();
  });

  it("ticket novo privado continua pending", async () => {
    findOne.mockResolvedValue(null);
    const created = makeTicket({
      id: 30,
      status: "pending",
      chatbot: false,
      queueId: null,
      userId: null
    });
    createTicket.mockResolvedValue(created);
    showTicket.mockImplementation(async () => created);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(createTicket.mock.calls[0][0]).toMatchObject({
      contactId: 7,
      status: "pending",
      isGroup: false,
      whatsappId: 3,
      companyId: 1
    });
    expect(result.id).toBe(30);
    expect(result.status).toBe("pending");
  });

  it("ticket novo de grupo continua open", async () => {
    findOne.mockResolvedValue(null);
    const groupContact = contact({
      id: 90,
      number: "120363111222333",
      isGroup: true
    });
    const created = makeTicket({
      id: 31,
      contactId: 90,
      isGroup: true,
      status: "open"
    });
    createTicket.mockResolvedValue(created);
    showTicket.mockImplementation(async () => created);

    const result = await FindOrCreateTicketService(
      contact(),
      3,
      1,
      1,
      groupContact
    );
    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 90,
        status: "open",
        isGroup: true
      })
    );
    expect(result.status).toBe("open");
  });

  it("reopen pending é idempotente para o listener Baileys", async () => {
    const ticket = makeTicket({ status: "closed" });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(ticket.status).toBe("pending");

    await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(ticket.status).toBe("pending");
    expect(createTicket).not.toHaveBeenCalled();
    const closedResets = (ticket.update as jest.Mock).mock.calls.filter(
      ([payload]: [Record<string, unknown>]) => payload.status === "pending"
    );
    expect(closedResets).toHaveLength(1);
  });

  it("CASO 1 — closed com handoff/pause anteriores limpa estado transitório da IA", async () => {
    const pausedAt = new Date("2026-09-23T12:00:00.000Z");
    const handoffAt = new Date("2026-09-23T12:00:01.000Z");
    const ticket = makeTicket({
      aiAgentPaused: true,
      aiAgentPausedAt: pausedAt,
      aiAgentPausedBy: 9,
      aiAgentHandoffRequested: true,
      aiAgentHandoffRequestedAt: handoffAt,
      aiAgentHandoffReason: "model_requested_handoff",
      aiAgentHandoffBy: "ai_agent"
    });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);

    expect(createTicket).not.toHaveBeenCalled();
    expect(result.id).toBe(11);
    expect(result.status).toBe("pending");
    expect(result.aiAgentPaused).toBe(false);
    expect(result.aiAgentPausedAt).toBeNull();
    expect(result.aiAgentPausedBy).toBeNull();
    expect(result.aiAgentHandoffRequested).toBe(false);
    expect(result.aiAgentHandoffRequestedAt).toBeNull();
    expect(result.aiAgentHandoffReason).toBeNull();
    expect(result.aiAgentHandoffBy).toBeNull();

    const reset = cycleResetPayload(ticket);
    expect(reset).toMatchObject({
      status: "pending",
      queueId: null,
      userId: null,
      chatbot: false,
      aiAgentPaused: false,
      aiAgentPausedAt: null,
      aiAgentPausedBy: null,
      aiAgentHandoffRequested: false,
      aiAgentHandoffRequestedAt: null,
      aiAgentHandoffReason: null,
      aiAgentHandoffBy: null
    });
  });

  it("CASO 2 — pending com handoff no mesmo ciclo não reseta a IA", async () => {
    const ticket = makeTicket({
      status: "pending",
      chatbot: false,
      queueId: null,
      userId: null,
      flowStopped: null,
      lastFlowId: null,
      flowWebhook: false,
      aiAgentPaused: true,
      aiAgentPausedAt: new Date("2026-09-23T12:00:00.000Z"),
      aiAgentPausedBy: 9,
      aiAgentHandoffRequested: true,
      aiAgentHandoffRequestedAt: new Date("2026-09-23T12:00:01.000Z"),
      aiAgentHandoffReason: "model_requested_handoff",
      aiAgentHandoffBy: "ai_agent"
    });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(result.status).toBe("pending");
    expect(result.aiAgentPaused).toBe(true);
    expect(result.aiAgentHandoffRequested).toBe(true);
    expect(result.aiAgentHandoffReason).toBe("model_requested_handoff");
    expect(cycleResetPayload(ticket)).toBeUndefined();
  });

  it("CASO 3 — open com handoff/pause no mesmo ciclo não reseta a IA", async () => {
    const ticket = makeTicket({
      status: "open",
      userId: 9,
      queueId: 4,
      chatbot: false,
      aiAgentPaused: true,
      aiAgentPausedAt: new Date("2026-09-23T12:00:00.000Z"),
      aiAgentPausedBy: 9,
      aiAgentHandoffRequested: true,
      aiAgentHandoffRequestedAt: new Date("2026-09-23T12:00:01.000Z"),
      aiAgentHandoffReason: "model_requested_handoff",
      aiAgentHandoffBy: "ai_agent"
    });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(result.status).toBe("open");
    expect(result.userId).toBe(9);
    expect(result.aiAgentPaused).toBe(true);
    expect(result.aiAgentHandoffRequested).toBe(true);
    expect(cycleResetPayload(ticket)).toBeUndefined();
  });

  it("CASO 4 — closed sem handoff continua o reopen normal", async () => {
    const ticket = makeTicket();
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(contact(), 3, 1, 1);
    expect(result.status).toBe("pending");
    expect(result.id).toBe(11);
    const reset = cycleResetPayload(ticket);
    expect(reset).toMatchObject({
      status: "pending",
      aiAgentPaused: false,
      aiAgentHandoffRequested: false,
      aiAgentHandoffReason: null
    });
  });

  it("CASO 5 — grupo closed não é forçado a pending e segue o reset transitório existente", async () => {
    const groupContact = contact({
      id: 90,
      number: "120363111222333",
      isGroup: true
    });
    const ticket = makeTicket({
      id: 20,
      contactId: 90,
      isGroup: true,
      status: "closed",
      aiAgentPaused: true,
      aiAgentPausedAt: new Date("2026-09-23T12:00:00.000Z"),
      aiAgentPausedBy: 9,
      aiAgentHandoffRequested: true,
      aiAgentHandoffRequestedAt: new Date("2026-09-23T12:00:01.000Z"),
      aiAgentHandoffReason: "model_requested_handoff",
      aiAgentHandoffBy: "ai_agent"
    });
    findOne.mockResolvedValue(ticket);
    showTicket.mockImplementation(async () => ticket);

    const result = await FindOrCreateTicketService(
      contact(),
      3,
      1,
      1,
      groupContact
    );

    expect(createTicket).not.toHaveBeenCalled();
    expect(result.id).toBe(20);
    expect(result.status).toBe("closed");
    expect(result.status).not.toBe("pending");

    const reset = cycleResetPayload(ticket);
    expect(reset).toBeDefined();
    expect(reset).not.toHaveProperty("status");
    expect(reset).toMatchObject({
      queueId: null,
      userId: null,
      chatbot: false,
      aiAgentPaused: false,
      aiAgentPausedAt: null,
      aiAgentPausedBy: null,
      aiAgentHandoffRequested: false,
      aiAgentHandoffRequestedAt: null,
      aiAgentHandoffReason: null,
      aiAgentHandoffBy: null
    });
  });
});
