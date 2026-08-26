/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

jest.mock("../../../../../../services/CompanyService/adjustCompanyStorageUsage", () => ({
  incrementCompanyStorageUsage: jest.fn()
}));

const createEvent = jest.fn();
const findMessage = jest.fn();
const findByPkMessage = jest.fn();
const createContact = jest.fn();
const findOrCreateTicket = jest.fn();
const createEvoMessage = jest.fn();
const resolveQuoted = jest.fn();

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    create: (...a: unknown[]) => createEvent(...a)
  }
}));

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findMessage(...a),
    findByPk: (...a: unknown[]) => findByPkMessage(...a)
  }
}));

jest.mock(
  "../../../../../../services/ContactServices/CreateOrUpdateContactService",
  () => ({
    __esModule: true,
    default: (...a: unknown[]) => createContact(...a)
  })
);

jest.mock(
  "../../../../../../services/TicketServices/FindOrCreateTicketService",
  () => ({
    __esModule: true,
    default: (...a: unknown[]) => findOrCreateTicket(...a)
  })
);

jest.mock("../createEvolutionInboundMessage", () => ({
  createEvolutionInboundMessage: (...a: unknown[]) => createEvoMessage(...a)
}));

jest.mock("../../../../inbound/resolveQuotedMessageByStanzaId", () => ({
  resolveQuotedMessageByStanzaId: (...a: unknown[]) => resolveQuoted(...a)
}));

import { processEvolutionWebhook } from "../processEvolutionWebhook";
import { UniqueConstraintError } from "sequelize";

describe("processEvolutionWebhook idempotency", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    findMessage.mockResolvedValue(null);
    findByPkMessage.mockResolvedValue(null);
    createContact.mockResolvedValue({ id: 5, number: "5511999998888" });
    findOrCreateTicket.mockResolvedValue({ id: 77, queueId: null });
    resolveQuoted.mockResolvedValue(null);
    createEvoMessage.mockResolvedValue({ id: "3EB0MSG1" });
    createEvent.mockImplementation(async (row: any) => ({
      id: 100,
      ...row,
      update: jest.fn().mockResolvedValue(undefined)
    }));
  });

  const body = {
    event: "MESSAGES_UPSERT",
    instance: "inst",
    data: {
      key: {
        remoteJid: "5511999998888@s.whatsapp.net",
        fromMe: false,
        id: "3EB0MSG1"
      },
      pushName: "Ana",
      message: { conversation: "oi" },
      messageType: "conversation",
      messageTimestamp: 1709553296
    },
    apikey: "secret"
  };

  it("processa texto e não chama outbound", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      body,
      apiKeyValid: true
    });
    expect(result.outcome).toBe("processed");
    expect(createEvoMessage).toHaveBeenCalled();
    expect(createContact).toHaveBeenCalled();
    expect(findOrCreateTicket).toHaveBeenCalled();
  });

  it("replay do mesmo webhook → duplicate sem recriar ticket", async () => {
    createEvent.mockRejectedValueOnce(new UniqueConstraintError({} as never));
    const result = await processEvolutionWebhook({
      whatsapp,
      body,
      apiKeyValid: true
    });
    expect(result.outcome).toBe("duplicate");
    expect(createContact).not.toHaveBeenCalled();
    expect(findOrCreateTicket).not.toHaveBeenCalled();
  });

  it("mesmo message id já em Message → duplicate", async () => {
    findMessage.mockResolvedValue({ id: "3EB0MSG1" });
    const result = await processEvolutionWebhook({
      whatsapp,
      body,
      apiKeyValid: true
    });
    expect(result.outcome).toBe("duplicate");
    expect(createEvoMessage).not.toHaveBeenCalled();
  });

  it("evento desconhecido → ignored", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      body: { event: "QRCODE_UPDATED", data: {} },
      apiKeyValid: true
    });
    expect(result.outcome).toBe("ignored_event");
  });

  it("pipeline evolution texto sem rawProviderMessage", async () => {
    await processEvolutionWebhook({ whatsapp, body, apiKeyValid: true });
    const inboundArg = createEvoMessage.mock.calls[0][0].inbound;
    expect(inboundArg.provider).toBe("evolution");
    expect(inboundArg.rawProviderMessage).toBeNull();
  });
});
