/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

jest.mock("../../../../../../services/CompanyService/adjustCompanyStorageUsage", () => ({
  incrementCompanyStorageUsage: jest.fn()
}));

jest.mock("../../../../../../libs/socket", () => ({
  getIO: () => ({
    to: () => ({
      emit: (...args: unknown[]) => mockEmit(...args)
    })
  })
}));

jest.mock("../../../../../../services/MessageServices/CreateMessageService", () => ({
  serializeMessageForClient: (m: unknown) => m
}));

const mockEmit = jest.fn();
const findOne = jest.fn();
const findByPk = jest.fn();
const createEvent = jest.fn();

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findOne(...a),
    findByPk: (...a: unknown[]) => findByPk(...a)
  }
}));

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    create: (...a: unknown[]) => createEvent(...a)
  }
}));

jest.mock("../../../../../../models/Contact", () => ({ __esModule: true, default: {} }));
jest.mock("../../../../../../models/Ticket", () => ({ __esModule: true, default: {} }));
jest.mock("../../../../../../models/Whatsapp", () => ({ __esModule: true, default: {} }));

jest.mock("../processEvolutionTextInbound", () => ({
  processEvolutionTextInbound: jest.fn()
}));

jest.mock("../createEvolutionInboundMessage", () => ({
  createEvolutionInboundMessage: jest.fn()
}));

jest.mock("../../../../inbound/resolveQuotedMessageByStanzaId", () => ({
  resolveQuotedMessageByStanzaId: jest.fn()
}));

import { UniqueConstraintError } from "sequelize";
import { processEvolutionWebhook } from "../processEvolutionWebhook";
import { applyNormalizedMessageStatus } from "../../../../inbound/applyNormalizedMessageStatus";

function messageRow(overrides: Record<string, unknown> = {}) {
  const update = jest.fn().mockResolvedValue(undefined);
  const row = {
    id: "BAE5ACK1",
    ack: 1,
    companyId: 1,
    ticketId: 77,
    ticket: { id: 77, whatsappId: 10, status: "open", queueId: null, contact: {} },
    update,
    ...overrides
  };
  return row;
}

describe("Evolution ACK Fase 9A", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    createEvent.mockImplementation(async (row: Record<string, unknown>) => ({
      id: 200,
      ...row,
      update: jest.fn().mockResolvedValue(undefined)
    }));
  });

  it("delivered atualiza Message.ack=3 e emite socket update", async () => {
    const row = messageRow({ ack: 2 });
    findOne.mockResolvedValueOnce(row);
    findByPk.mockResolvedValue(row);

    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPDATE",
        data: {
          keyId: "BAE5ACK1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: true,
          status: "DELIVERY_ACK"
        }
      }
    });

    expect(result.outcome).toBe("processed");
    expect(result.ack).toBe(3);
    expect(row.update).toHaveBeenCalledWith({ ack: 3 });
    expect(mockEmit).toHaveBeenCalledWith(
      "company-1-appMessage",
      expect.objectContaining({ action: "update" })
    );
  });

  it("read / played / failed mapeiam corretamente", async () => {
    for (const [status, ack] of [
      ["READ", 4],
      ["PLAYED", 5],
      ["ERROR", 0]
    ] as const) {
      jest.clearAllMocks();
      const row = messageRow({ ack: status === "ERROR" ? 1 : 2 });
      findOne.mockResolvedValue(row);
      findByPk.mockResolvedValue(row);
      createEvent.mockImplementation(async (r: Record<string, unknown>) => ({
        id: 1,
        ...r,
        update: jest.fn().mockResolvedValue(undefined)
      }));

      const result = await processEvolutionWebhook({
        whatsapp,
        apiKeyValid: true,
        body: {
          event: "MESSAGES_UPDATE",
          data: { keyId: "BAE5ACK1", status, fromMe: true, remoteJid: "x@s.whatsapp.net" }
        }
      });
      expect(result.ack).toBe(ack);
      expect(row.update).toHaveBeenCalledWith({ ack });
    }
  });

  it("downgrade bloqueado: READ não regride para DELIVERY", async () => {
    const row = messageRow({ ack: 4 });
    findOne.mockResolvedValue(row);

    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPDATE",
        data: {
          keyId: "BAE5ACK1",
          status: "DELIVERY_ACK",
          fromMe: true,
          remoteJid: "x@s.whatsapp.net"
        }
      }
    });

    expect(result.outcome).toBe("processed");
    expect(result.reason).toBe("noop_same_or_lower");
    expect(row.update).not.toHaveBeenCalled();
  });

  it("failed tardio após READ não regride", async () => {
    const row = messageRow({ ack: 4 });
    findOne.mockResolvedValue(row);
    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPDATE",
        data: {
          keyId: "BAE5ACK1",
          status: "ERROR",
          fromMe: true,
          remoteJid: "x@s.whatsapp.net"
        }
      }
    });
    expect(result.reason).toBe("noop_same_or_lower");
    expect(row.update).not.toHaveBeenCalled();
  });

  it("evento duplicado (unique externalEventId) → duplicate", async () => {
    createEvent.mockRejectedValueOnce(new UniqueConstraintError({} as never));
    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPDATE",
        data: {
          keyId: "BAE5ACK1",
          status: "READ",
          fromMe: true,
          remoteJid: "x@s.whatsapp.net"
        }
      }
    });
    expect(result.outcome).toBe("duplicate");
  });

  it("ACK antes da Message: deferred — sem Message/Ticket/Contact fake", async () => {
    findOne.mockResolvedValue(null);
    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPDATE",
        data: {
          keyId: "MISSING1",
          status: "DELIVERY_ACK",
          fromMe: true,
          remoteJid: "x@s.whatsapp.net"
        }
      }
    });
    expect(result.outcome).toBe("deferred");
    expect(result.reason).toBe("message_not_found");
    expect(createEvent).toHaveBeenCalled();
    const created = createEvent.mock.calls[0][0];
    expect(created.processingStatus).toBe("received");
  });

  it("conexão Baileys rejeitada", async () => {
    const result = await processEvolutionWebhook({
      whatsapp: {
        id: 1,
        companyId: 1,
        connectionProvider: "baileys"
      } as never,
      apiKeyValid: true,
      body: { event: "MESSAGES_UPDATE", data: { keyId: "x", status: "READ" } }
    });
    expect(result.outcome).toBe("error");
    expect(result.reason).toBe("not_evolution_connection");
  });

  it("evento unknown continua ignored", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: { event: "QRCODE_UPDATED", data: {} }
    });
    expect(result.outcome).toBe("ignored_event");
  });

  it("lookup companyId + externalMessageId", async () => {
    const row = messageRow({ ack: 2 });
    findOne.mockResolvedValue(row);
    findByPk.mockResolvedValue(row);
    await applyNormalizedMessageStatus({
      provider: "evolution",
      companyId: 1,
      whatsappId: 10,
      messageId: "BAE5ACK1",
      ack: 3,
      fromMe: true,
      remoteJid: "x@s.whatsapp.net",
      participant: null,
      timestamp: null,
      providerStatus: "DELIVERY_ACK"
    });
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 1, externalMessageId: "BAE5ACK1" }
      })
    );
  });

  it("progressivo SERVER → DELIVERY → READ", async () => {
    const row = messageRow({ ack: 2 });
    findOne.mockResolvedValue(row);
    findByPk.mockResolvedValue(row);
    await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPDATE",
        data: {
          keyId: "BAE5ACK1",
          status: "DELIVERY_ACK",
          fromMe: true,
          remoteJid: "x@s.whatsapp.net"
        }
      }
    });
    expect(row.update).toHaveBeenCalledWith({ ack: 3 });
    row.ack = 3;
    await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPDATE",
        data: {
          keyId: "BAE5ACK1",
          status: "READ",
          fromMe: true,
          remoteJid: "x@s.whatsapp.net"
        }
      }
    });
    expect(row.update).toHaveBeenCalledWith({ ack: 4 });
  });
});
