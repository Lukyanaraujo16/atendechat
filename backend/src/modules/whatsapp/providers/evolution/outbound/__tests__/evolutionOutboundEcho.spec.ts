/* eslint-disable import/first */
/**
 * Send Evolution → persist Message → webhook fromMe eco → sem duplicata.
 */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {},
  jidNormalizedUser: (j: string) => j
}));

jest.mock("../../../../../../services/CompanyService/adjustCompanyStorageUsage", () => ({
  incrementCompanyStorageUsage: jest.fn()
}));

const createEvent = jest.fn();
const messages = new Map<string, { id: string; externalMessageId?: string }>();

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    create: (...a: unknown[]) => createEvent(...a)
  }
}));

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: async ({ where }: any) => {
      if (where?.externalMessageId) {
        for (const m of messages.values()) {
          if (m.externalMessageId === where.externalMessageId) return m;
        }
      }
      return null;
    },
    findByPk: async (id: string) => messages.get(id) || null,
    upsert: async (row: any) => {
      messages.set(row.id, row);
    }
  }
}));

jest.mock(
  "../../../../../../services/ContactServices/CreateOrUpdateContactService",
  () => ({
    __esModule: true,
    default: jest.fn(async () => ({ id: 5, number: "5511999998888" }))
  })
);

jest.mock(
  "../../../../../../services/TicketServices/FindOrCreateTicketService",
  () => ({
    __esModule: true,
    default: jest.fn(async () => ({ id: 77, queueId: null }))
  })
);

jest.mock("../../inbound/createEvolutionInboundMessage", () => ({
  createEvolutionInboundMessage: jest.fn(async ({ inbound }: any) => {
    if (messages.has(inbound.messageId)) {
      return messages.get(inbound.messageId);
    }
    const row = {
      id: inbound.messageId,
      externalMessageId: inbound.messageId
    };
    messages.set(inbound.messageId, row);
    return row;
  })
}));

jest.mock("../../../../inbound/resolveQuotedMessageByStanzaId", () => ({
  resolveQuotedMessageByStanzaId: jest.fn(async () => null)
}));

jest.mock("../../inbound/evolutionHttpClient", () => ({
  EvolutionHttpError: class extends Error {
    code: string;
    constructor(c: string, m: string) {
      super(m);
      this.code = c;
    }
  },
  evolutionSendText: jest.fn(async () => ({
    key: {
      id: "ECHO_ID_1",
      remoteJid: "5511999998888@s.whatsapp.net",
      fromMe: true
    },
    status: "PENDING"
  })),
  evolutionSendMedia: jest.fn(),
  evolutionSendWhatsAppAudio: jest.fn(),
  evolutionSendSticker: jest.fn()
}));

import { EvolutionWhatsAppOutbound } from "../EvolutionWhatsAppOutbound";
import { processEvolutionWebhook } from "../../inbound/processEvolutionWebhook";
import { UniqueConstraintError } from "sequelize";
import { createEvolutionInboundMessage } from "../../inbound/createEvolutionInboundMessage";

const createEvoMsg = createEvolutionInboundMessage as jest.Mock;

describe("Evolution outbound → eco fromMe idempotência", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    messages.clear();
    createEvent.mockImplementation(async (row: any) => ({
      id: 1,
      ...row,
      update: jest.fn()
    }));
  });

  it("send persiste id X; webhook fromMe com X não cria segunda Message", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    const sent = await outbound.sendText({
      jid: "5511999998888@s.whatsapp.net",
      text: "oi campanha\u200c"
    });
    expect(sent.messageId).toBe("ECHO_ID_1");

    // Persistência outbound (simulando AI/MessageController)
    messages.set(sent.messageId!, {
      id: sent.messageId!,
      externalMessageId: sent.messageId!
    });

    const webhook = await processEvolutionWebhook({
      whatsapp,
      body: {
        event: "MESSAGES_UPSERT",
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: true,
            id: "ECHO_ID_1"
          },
          message: { conversation: "oi campanha\u200c" },
          messageType: "conversation",
          messageTimestamp: 1
        }
      },
      apiKeyValid: true
    });

    expect(webhook.outcome).toBe("duplicate");
    expect(createEvoMsg).not.toHaveBeenCalled();
    expect(messages.size).toBe(1);
  });

  it("replay webhook unique também protege", async () => {
    createEvent.mockRejectedValueOnce(new UniqueConstraintError({} as never));
    const webhook = await processEvolutionWebhook({
      whatsapp,
      body: {
        event: "MESSAGES_UPSERT",
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: true,
            id: "ECHO_ID_1"
          },
          message: { conversation: "x" },
          messageType: "conversation",
          messageTimestamp: 1
        }
      },
      apiKeyValid: true
    });
    expect(webhook.outcome).toBe("duplicate");
  });
});
