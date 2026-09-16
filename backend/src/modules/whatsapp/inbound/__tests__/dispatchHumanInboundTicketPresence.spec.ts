/* eslint-disable import/first */
const emit = jest.fn();
const to = jest.fn(() => ({ emit }));
const findContact = jest.fn();
const findTicket = jest.fn();
const findMessage = jest.fn();

jest.mock("../../../../libs/socket", () => ({
  getIO: () => ({ to })
}));

jest.mock("../../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findContact(...a),
    create: jest.fn()
  }
}));

jest.mock("../../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findTicket(...a),
    create: jest.fn()
  }
}));

jest.mock("../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findMessage(...a),
    create: jest.fn()
  }
}));

jest.mock("../../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import Contact from "../../../../models/Contact";
import Message from "../../../../models/Message";
import Ticket from "../../../../models/Ticket";
import {
  dispatchHumanInboundTicketPresence,
  resetHumanInboundPresenceThrottleForTests,
  shouldEmitHumanInboundPresence,
  HUMAN_INBOUND_PRESENCE_HEARTBEAT_MS
} from "../dispatchHumanInboundTicketPresence";

const contactCreate = Contact.create as jest.Mock;
const messageCreate = Message.create as jest.Mock;
const ticketCreate = Ticket.create as jest.Mock;

const CLIENT = "5511999998888@s.whatsapp.net";

describe("dispatchHumanInboundTicketPresence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHumanInboundPresenceThrottleForTests();
    findContact.mockResolvedValue({ id: 5 });
    findTicket.mockResolvedValue({
      id: 77,
      companyId: 1,
      whatsappId: 10,
      status: "open"
    });
    findMessage.mockResolvedValue(null);
  });

  it("ticket open correto emite só na room do ticket", async () => {
    const result = await dispatchHumanInboundTicketPresence({
      companyId: 1,
      whatsappId: 10,
      remoteJid: CLIENT,
      presence: "composing"
    });
    expect(result).toEqual({ emitted: true, ticketId: 77 });
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith("77");
    expect(emit).toHaveBeenCalledWith("company-1-ticketPresence", {
      ticketId: 77,
      presence: "composing"
    });
    const payload = emit.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(["presence", "ticketId"]);
  });

  it("pending emite", async () => {
    findTicket.mockResolvedValue({ id: 8, status: "pending" });
    const result = await dispatchHumanInboundTicketPresence({
      companyId: 1,
      whatsappId: 10,
      remoteJid: CLIENT,
      presence: "composing"
    });
    expect(result.emitted).toBe(true);
    expect(result.ticketId).toBe(8);
  });

  it("closed/inexistente ignora e não cria entidades", async () => {
    findTicket.mockResolvedValue(null);
    const result = await dispatchHumanInboundTicketPresence({
      companyId: 1,
      whatsappId: 10,
      remoteJid: CLIENT,
      presence: "composing"
    });
    expect(result).toEqual({ emitted: false, skipped: "no_ticket" });
    expect(emit).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
    expect(contactCreate).not.toHaveBeenCalled();
    expect(ticketCreate).not.toHaveBeenCalled();
  });

  it("isolamento company/whatsapp no lookup", async () => {
    await dispatchHumanInboundTicketPresence({
      companyId: 9,
      whatsappId: 22,
      remoteJid: CLIENT,
      presence: "composing"
    });
    expect(findContact).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 9,
          whatsappId: 22,
          number: "5511999998888"
        })
      })
    );
    expect(findTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 9,
          whatsappId: 22,
          contactId: 5
        })
      })
    );
  });

  it("múltiplos tickets usa o findOne ordenado por updatedAt DESC", async () => {
    await dispatchHumanInboundTicketPresence({
      companyId: 1,
      whatsappId: 10,
      remoteJid: CLIENT,
      presence: "paused"
    });
    expect(findTicket.mock.calls[0][0].order).toEqual([
      ["updatedAt", "DESC"],
      ["id", "DESC"]
    ]);
  });

  it("sem contact usa Message.remoteJid e ainda isola company/whatsapp", async () => {
    findContact.mockResolvedValue(null);
    findMessage.mockResolvedValue({ ticketId: 44 });
    findTicket.mockResolvedValue({ id: 44, status: "open" });
    const result = await dispatchHumanInboundTicketPresence({
      companyId: 3,
      whatsappId: 8,
      remoteJid: CLIENT,
      presence: "composing"
    });
    expect(result).toEqual({ emitted: true, ticketId: 44 });
    expect(findMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 3, remoteJid: CLIENT }
      })
    );
    expect(findTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 44,
          companyId: 3,
          whatsappId: 8
        })
      })
    );
  });

  it("composing repetido na janela não emite de novo", async () => {
    await dispatchHumanInboundTicketPresence({
      companyId: 1,
      whatsappId: 10,
      remoteJid: CLIENT,
      presence: "composing"
    });
    emit.mockClear();
    to.mockClear();
    const second = await dispatchHumanInboundTicketPresence({
      companyId: 1,
      whatsappId: 10,
      remoteJid: CLIENT,
      presence: "composing"
    });
    expect(second).toEqual({ emitted: false, skipped: "throttled" });
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("shouldEmitHumanInboundPresence throttle", () => {
  beforeEach(() => {
    resetHumanInboundPresenceThrottleForTests();
  });

  it("primeiro composing emite; repetido na janela não; heartbeat após 3s emite", () => {
    const now = 1_000_000;
    expect(
      shouldEmitHumanInboundPresence({
        whatsappId: 1,
        remoteJid: CLIENT,
        presence: "composing",
        now
      })
    ).toBe(true);
    expect(
      shouldEmitHumanInboundPresence({
        whatsappId: 1,
        remoteJid: CLIENT,
        presence: "composing",
        now: now + HUMAN_INBOUND_PRESENCE_HEARTBEAT_MS - 1
      })
    ).toBe(false);
    expect(
      shouldEmitHumanInboundPresence({
        whatsappId: 1,
        remoteJid: CLIENT,
        presence: "composing",
        now: now + HUMAN_INBOUND_PRESENCE_HEARTBEAT_MS
      })
    ).toBe(true);
  });

  it("composing→recording e composing→paused emitem na hora; paused repetido não", () => {
    const now = 2_000_000;
    expect(
      shouldEmitHumanInboundPresence({
        whatsappId: 1,
        remoteJid: CLIENT,
        presence: "composing",
        now
      })
    ).toBe(true);
    expect(
      shouldEmitHumanInboundPresence({
        whatsappId: 1,
        remoteJid: CLIENT,
        presence: "recording",
        now: now + 10
      })
    ).toBe(true);
    expect(
      shouldEmitHumanInboundPresence({
        whatsappId: 1,
        remoteJid: CLIENT,
        presence: "paused",
        now: now + 20
      })
    ).toBe(true);
    expect(
      shouldEmitHumanInboundPresence({
        whatsappId: 1,
        remoteJid: CLIENT,
        presence: "paused",
        now: now + 30
      })
    ).toBe(false);
  });

  it("cleanup remove entradas antigas", () => {
    const now = 3_000_000;
    shouldEmitHumanInboundPresence({
      whatsappId: 1,
      remoteJid: CLIENT,
      presence: "composing",
      now
    });
    expect(
      shouldEmitHumanInboundPresence({
        whatsappId: 1,
        remoteJid: CLIENT,
        presence: "composing",
        now: now + 31_000
      })
    ).toBe(true);
  });
});
