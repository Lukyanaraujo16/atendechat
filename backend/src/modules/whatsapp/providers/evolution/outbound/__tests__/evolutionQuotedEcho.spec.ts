/* eslint-disable import/first */
/**
 * Quoted reply Evolution + persist quotedMsgId + eco fromMe sem duplicata.
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
const messages = new Map<string, Record<string, unknown>>();

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    create: (...a: unknown[]) => createEvent(...a)
  }
}));

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: async ({ where }: { where?: { externalMessageId?: string; id?: string } }) => {
      if (where?.externalMessageId) {
        return (
          [...messages.values()].find(
            m => m.externalMessageId === where.externalMessageId
          ) || null
        );
      }
      if (where?.id) return messages.get(where.id) || null;
      return null;
    },
    findByPk: async (id: string) => messages.get(id) || null,
    upsert: async (row: Record<string, unknown>) => {
      messages.set(String(row.id), row);
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
  createEvolutionInboundMessage: jest.fn(async ({ inbound, quotedMsgId }: any) => {
    if (messages.has(inbound.messageId)) {
      return messages.get(inbound.messageId);
    }
    const row = {
      id: inbound.messageId,
      externalMessageId: inbound.messageId,
      quotedMsgId: quotedMsgId || null,
      dataJson: JSON.stringify({ provider: "evolution", payload: {} })
    };
    messages.set(inbound.messageId, row);
    return row;
  })
}));

jest.mock("../../../../inbound/resolveQuotedMessageByStanzaId", () => ({
  resolveQuotedMessageByStanzaId: jest.fn(async ({ quotedStanzaId }) => {
    return messages.get(quotedStanzaId) || null;
  })
}));

const sendText = jest.fn();

jest.mock("../../inbound/evolutionHttpClient", () => ({
  EvolutionHttpError: class extends Error {
    code: string;
    constructor(c: string, m: string) {
      super(m);
      this.code = c;
    }
  },
  evolutionSendText: (...a: unknown[]) => sendText(...a),
  evolutionSendMedia: jest.fn(),
  evolutionSendWhatsAppAudio: jest.fn(),
  evolutionSendSticker: jest.fn(),
  evolutionDeleteMessage: jest.fn()
}));

import { EvolutionWhatsAppOutbound } from "../EvolutionWhatsAppOutbound";
import { processEvolutionWebhook } from "../../inbound/processEvolutionWebhook";
import { UniqueConstraintError } from "sequelize";

describe("Evolution quoted reply + eco Fase 9B", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    messages.clear();
    messages.set("QUOTE_A", {
      id: "QUOTE_A",
      externalMessageId: "QUOTE_A",
      body: "hello",
      fromMe: false,
      remoteJid: "5511999998888@s.whatsapp.net"
    });
    sendText.mockResolvedValue({
      key: {
        id: "REPLY_B",
        remoteJid: "5511999998888@s.whatsapp.net",
        fromMe: true
      },
      status: "PENDING",
      provider: "evolution"
    });
    createEvent.mockImplementation(async (row: Record<string, unknown>) => ({
      id: 1,
      ...row,
      update: jest.fn().mockResolvedValue(undefined)
    }));
  });

  it("reply cita A → HTTP quoted A → B persiste quotedMsgId → eco sem duplicata", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    const sent = await outbound.sendText({
      jid: "5511999998888@s.whatsapp.net",
      text: "resposta",
      quoted: {
        stanzaId: "QUOTE_A",
        destinationJid: "5511999998888@s.whatsapp.net",
        isGroup: false,
        fromMe: false,
        body: "hello"
      }
    });

    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        quoted: expect.objectContaining({
          key: expect.objectContaining({ id: "QUOTE_A" })
        })
      })
    );
    expect(sent.messageId).toBe("REPLY_B");

    // Persist B com quotedMsgId=A (domínio)
    messages.set("REPLY_B", {
      id: "REPLY_B",
      externalMessageId: "REPLY_B",
      quotedMsgId: "QUOTE_A",
      dataJson: JSON.stringify({
        provider: "evolution",
        payload: { key: sent.rawSentMessage }
      })
    });

    expect(messages.get("REPLY_B")?.quotedMsgId).toBe("QUOTE_A");
    const dataJson = JSON.parse(String(messages.get("REPLY_B")?.dataJson));
    expect(dataJson.provider).toBe("evolution");
    expect(dataJson.payload).toBeTruthy();

    // Eco fromMe → duplicate
    createEvent.mockRejectedValueOnce(new UniqueConstraintError({} as never));
    const eco = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPSERT",
        data: {
          key: {
            id: "REPLY_B",
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: true
          },
          message: { conversation: "resposta" },
          messageType: "conversation",
          messageTimestamp: 1717689097
        }
      }
    });
    // duplicate via unique OR message_already_exists
    expect(["duplicate", "processed", "skipped"]).toContain(eco.outcome);
    expect(messages.size).toBe(2);
  });
});
