/* eslint-disable import/first */
import { NormalizedWhatsAppMessage } from "../../../../inbound/NormalizedWhatsAppMessage";

jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

jest.mock(
  "../../../../../../services/CompanyService/adjustCompanyStorageUsage",
  () => ({
    incrementCompanyStorageUsage: jest.fn()
  })
);

const getWbot = jest.fn();
const getTicketWbot = jest.fn();
const getWhatsappWbot = jest.fn();
const wrapBaileysSession = jest.fn();

jest.mock("../../../../../../libs/wbot", () => ({
  getWbot: (...a: unknown[]) => getWbot(...a)
}));

jest.mock("../../../../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: (...a: unknown[]) => getTicketWbot(...a)
}));

jest.mock("../../../../../../helpers/GetWhatsappWbot", () => ({
  __esModule: true,
  default: (...a: unknown[]) => getWhatsappWbot(...a)
}));

jest.mock("../../../../outbound/resolveWhatsAppOutbound", () => ({
  wrapBaileysSession: (...a: unknown[]) => wrapBaileysSession(...a),
  getWhatsAppOutboundForTicket: jest.fn(),
  getWhatsAppOutboundForWhatsapp: jest.fn()
}));

const createContact = jest.fn();
const findOrCreateTicket = jest.fn();
const createEvoMessage = jest.fn();
const resolveQuoted = jest.fn();
const findMessage = jest.fn();
const findByPkMessage = jest.fn();

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

const resolveSettings = jest.fn();
jest.mock("../../../../../../helpers/resolveWhatsappSettings", () => ({
  resolveWhatsappSettings: (...a: unknown[]) => resolveSettings(...a)
}));

import { processEvolutionTextInbound } from "../processEvolutionTextInbound";
import { processInboundAutomation } from "../../../../automation/processInboundAutomation";

function privateInbound(
  partial: Partial<NormalizedWhatsAppMessage> = {}
): NormalizedWhatsAppMessage {
  return {
    provider: "evolution",
    companyId: 1,
    whatsappId: 10,
    messageId: "EVO1",
    fromMe: false,
    timestamp: new Date(),
    messageType: "conversation",
    body: "oi",
    pushName: "Ana",
    isGroup: false,
    addressing: {
      remoteJid: "5511999998888@s.whatsapp.net",
      participant: ""
    },
    senderNumber: "5511999998888",
    quotedStanzaId: null,
    mentionedJids: [],
    media: {
      hasMedia: false,
      mimetype: null,
      filename: null,
      caption: null,
      isPtt: false
    },
    wrapping: { isEphemeral: false, isViewOnce: false },
    messageStubType: null,
    ack: null,
    editedMessageId: null,
    rawProviderMessage: null,
    ...partial
  };
}

const whatsapp = {
  id: 10,
  companyId: 1,
  connectionProvider: "evolution",
  integrationId: null,
  promptId: null
} as never;

describe("processEvolutionTextInbound → inbound automation 12.3-B", () => {
  const runAutomation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    findMessage.mockResolvedValue(null);
    findByPkMessage.mockResolvedValue(null);
    createContact.mockResolvedValue({
      id: 5,
      number: "5511999998888",
      companyId: 1
    });
    findOrCreateTicket.mockResolvedValue({
      id: 77,
      companyId: 1,
      whatsappId: 10,
      contactId: 5,
      isGroup: false,
      queueId: null,
      userId: null,
      chatbot: false,
      useIntegration: false,
      integrationId: null,
      promptId: null
    });
    resolveQuoted.mockResolvedValue(null);
    createEvoMessage.mockResolvedValue({ id: "EVO1" });
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: "receive" }
    });
    runAutomation.mockResolvedValue({
      status: "ready",
      context: {
        companyId: 1,
        whatsappId: 10,
        ticketId: 77,
        contactId: 5,
        messageId: "EVO1",
        persistedMessageId: "EVO1",
        provider: "evolution",
        fromMe: false,
        isGroup: false
      },
      intendedConsumers: ["verifyQueue"],
      socketBoundConsumers: ["verifyQueue"]
    });
  });

  it("mensagem privada persistida entra na boundary com tenant correto", async () => {
    const result = await processEvolutionTextInbound({
      inbound: privateInbound(),
      whatsapp,
      evolutionPayloadSanitized: {},
      deps: { processInboundAutomation: runAutomation }
    });

    expect(result).toEqual({
      status: "created",
      messageId: "EVO1",
      ticketId: 77
    });
    expect(runAutomation).toHaveBeenCalledTimes(1);
    const arg = runAutomation.mock.calls[0][0];
    expect(arg.inbound.provider).toBe("evolution");
    expect(arg.ticket).toMatchObject({
      id: 77,
      companyId: 1,
      whatsappId: 10,
      contactId: 5
    });
    expect(arg.contact).toMatchObject({ id: 5, companyId: 1 });
    expect(arg.whatsapp).toMatchObject({ id: 10, companyId: 1 });
    expect(arg.persistedMessageId).toBe("EVO1");
    expect(runAutomation.mock.calls[0][1]).toBeUndefined();
    expect(getWbot).not.toHaveBeenCalled();
    expect(getTicketWbot).not.toHaveBeenCalled();
    expect(getWhatsappWbot).not.toHaveBeenCalled();
    expect(wrapBaileysSession).not.toHaveBeenCalled();
  });

  it("grupo persistido chama a boundary (skip de grupo fica no core)", async () => {
    findOrCreateTicket.mockResolvedValue({
      id: 88,
      companyId: 1,
      whatsappId: 10,
      contactId: 5,
      isGroup: true
    });
    createContact
      .mockResolvedValueOnce({ id: 9, number: "120363111", companyId: 1 })
      .mockResolvedValueOnce({ id: 5, number: "5511999998888", companyId: 1 });
    createEvoMessage.mockResolvedValue({ id: "GRP1" });

    await processEvolutionTextInbound({
      inbound: privateInbound({
        messageId: "GRP1",
        isGroup: true,
        addressing: {
          remoteJid: "120363111222333@g.us",
          participant: "5511999998888@s.whatsapp.net"
        },
        senderNumber: "5511999998888"
      }),
      whatsapp,
      evolutionPayloadSanitized: {},
      deps: { processInboundAutomation: runAutomation }
    });

    expect(runAutomation).toHaveBeenCalledTimes(1);
    expect(runAutomation.mock.calls[0][0].ticket.isGroup).toBe(true);
    expect(runAutomation.mock.calls[0][0].inbound.isGroup).toBe(true);
    expect(getWbot).not.toHaveBeenCalled();
  });

  it("fromMe persistido ainda entra na boundary (core decide skip)", async () => {
    await processEvolutionTextInbound({
      inbound: privateInbound({ fromMe: true, messageId: "FROME1" }),
      whatsapp,
      evolutionPayloadSanitized: {},
      deps: { processInboundAutomation: runAutomation }
    });
    expect(createEvoMessage).toHaveBeenCalled();
    expect(runAutomation).toHaveBeenCalledTimes(1);
    expect(runAutomation.mock.calls[0][0].inbound.fromMe).toBe(true);
  });

  it("evento duplicado não executa automação duas vezes", async () => {
    findMessage.mockResolvedValue({ id: "EVO1" });

    const first = await processEvolutionTextInbound({
      inbound: privateInbound(),
      whatsapp,
      evolutionPayloadSanitized: {},
      deps: { processInboundAutomation: runAutomation }
    });
    expect(first).toEqual({ status: "duplicate", messageId: "EVO1" });
    expect(createEvoMessage).not.toHaveBeenCalled();
    expect(runAutomation).not.toHaveBeenCalled();

    findMessage.mockResolvedValue({ id: "EVO1" });
    const second = await processEvolutionTextInbound({
      inbound: privateInbound(),
      whatsapp,
      evolutionPayloadSanitized: {},
      deps: { processInboundAutomation: runAutomation }
    });
    expect(second).toEqual({ status: "duplicate", messageId: "EVO1" });
    expect(runAutomation).not.toHaveBeenCalled();
    expect(getWbot).not.toHaveBeenCalled();
    expect(getWhatsappWbot).not.toHaveBeenCalled();
  });

  it("falha de mídia não dispara automação", async () => {
    const result = await processEvolutionTextInbound({
      inbound: privateInbound({
        messageId: "IMG1",
        messageType: "imageMessage",
        media: {
          hasMedia: true,
          mimetype: "image/jpeg",
          filename: null,
          caption: "oi",
          isPtt: false
        }
      }),
      whatsapp,
      evolutionPayloadSanitized: {},
      mediaHints: null,
      deps: { processInboundAutomation: runAutomation }
    });
    expect(result.status).toBe("media_failed");
    expect(runAutomation).not.toHaveBeenCalled();
  });

  it("core real: privado Evolution ready sem getWbot; grupo skipped", async () => {
    const privateResult = await processEvolutionTextInbound({
      inbound: privateInbound({ messageId: "REAL1" }),
      whatsapp,
      evolutionPayloadSanitized: {},
      deps: { processInboundAutomation }
    });
    expect(privateResult.status).toBe("created");
    expect(getWbot).not.toHaveBeenCalled();
    expect(getTicketWbot).not.toHaveBeenCalled();
    expect(getWhatsappWbot).not.toHaveBeenCalled();
    expect(wrapBaileysSession).not.toHaveBeenCalled();

    findOrCreateTicket.mockResolvedValue({
      id: 88,
      companyId: 1,
      whatsappId: 10,
      contactId: 5,
      isGroup: true
    });
    createContact
      .mockResolvedValueOnce({ id: 9, number: "120363111", companyId: 1 })
      .mockResolvedValueOnce({ id: 5, number: "5511999998888", companyId: 1 });
    createEvoMessage.mockResolvedValue({ id: "REALGRP" });

    const groupResult = await processEvolutionTextInbound({
      inbound: privateInbound({
        messageId: "REALGRP",
        isGroup: true,
        addressing: {
          remoteJid: "120363111222333@g.us",
          participant: "5511999998888@s.whatsapp.net"
        },
        senderNumber: "5511999998888"
      }),
      whatsapp,
      evolutionPayloadSanitized: {},
      deps: { processInboundAutomation }
    });
    expect(groupResult.status).toBe("created");
    expect(getWbot).not.toHaveBeenCalled();
    expect(wrapBaileysSession).not.toHaveBeenCalled();
  });
});
