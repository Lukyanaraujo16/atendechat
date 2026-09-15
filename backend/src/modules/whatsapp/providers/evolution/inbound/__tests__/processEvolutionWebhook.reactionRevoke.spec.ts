/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

jest.mock("../../../../../../libs/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: jest.fn() })
  })
}));

jest.mock(
  "../../../../../../services/CompanyService/adjustCompanyStorageUsage",
  () => ({
    incrementCompanyStorageUsage: jest.fn()
  })
);

const createEvent = jest.fn();
const findMessage = jest.fn();
const findByPkMessage = jest.fn();
const createContact = jest.fn();
const findOrCreateTicket = jest.fn();
const createEvoMessage = jest.fn();
const applyReaction = jest.fn();
const applyRevoke = jest.fn();

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
  resolveQuotedMessageByStanzaId: jest.fn()
}));

jest.mock("../../../../inbound/applyInboundWhatsAppReaction", () => ({
  applyInboundWhatsAppReaction: (...a: unknown[]) => applyReaction(...a)
}));

jest.mock("../../../../inbound/applyInboundWhatsAppRevoke", () => ({
  applyInboundWhatsAppRevoke: (...a: unknown[]) => applyRevoke(...a)
}));

import { processEvolutionWebhook } from "../processEvolutionWebhook";

describe("processEvolutionWebhook — reaction e revoke", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    findMessage.mockResolvedValue(null);
    findByPkMessage.mockResolvedValue(null);
    createContact.mockResolvedValue({ id: 5 });
    findOrCreateTicket.mockResolvedValue({ id: 77, queueId: null });
    createEvent.mockImplementation(async (row: Record<string, unknown>) => ({
      id: 300,
      ...row,
      update: jest.fn().mockResolvedValue(undefined)
    }));
    applyReaction.mockResolvedValue({
      outcome: "updated",
      targetMessageId: "TARGET1",
      ticketId: 77
    });
    applyRevoke.mockResolvedValue({
      outcome: "updated",
      messageId: "TARGET1",
      ticketId: 77
    });
  });

  it("reaction inbound não cria Message de timeline", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPSERT",
        instance: "inst",
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "R1"
          },
          pushName: "Ana",
          message: {
            reactionMessage: {
              text: "😂",
              key: { id: "TARGET1" }
            }
          },
          messageType: "reactionMessage",
          messageTimestamp: 1
        }
      }
    });

    expect(result.outcome).toBe("processed");
    expect(applyReaction).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        whatsappId: 10,
        reactorMessageId: "R1",
        reaction: { targetStanzaId: "TARGET1", emoji: "😂" }
      })
    );
    expect(createEvoMessage).not.toHaveBeenCalled();
    expect(createContact).not.toHaveBeenCalled();
    expect(findOrCreateTicket).not.toHaveBeenCalled();
  });

  it("MESSAGES_DELETE aplica revoke no alvo comprovado", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_DELETE",
        instance: "inst",
        data: {
          id: "TARGET1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
          status: "DELETED"
        }
      }
    });

    expect(result.outcome).toBe("processed");
    expect(applyRevoke).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        whatsappId: 10,
        messageId: "TARGET1"
      })
    );
    expect(createEvoMessage).not.toHaveBeenCalled();
  });

  it("replay de MESSAGES_DELETE é duplicate", async () => {
    const { UniqueConstraintError } = await import("sequelize");
    createEvent.mockRejectedValueOnce(new UniqueConstraintError({} as never));
    const result = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_DELETE",
        data: {
          id: "TARGET1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
          status: "DELETED"
        }
      }
    });
    expect(result.outcome).toBe("duplicate");
    expect(applyRevoke).not.toHaveBeenCalled();
  });
});
