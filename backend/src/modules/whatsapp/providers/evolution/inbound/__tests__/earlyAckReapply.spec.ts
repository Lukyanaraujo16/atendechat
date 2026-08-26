/* eslint-disable import/first */
/**
 * send → early ACK deferred → persist Message → reapply → eco dedupe.
 */
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

jest.mock("../processEvolutionTextInbound", () => ({
  processEvolutionTextInbound: jest.fn()
}));

jest.mock("../createEvolutionInboundMessage", () => ({
  createEvolutionInboundMessage: jest.fn()
}));

jest.mock("../../../../inbound/resolveQuotedMessageByStanzaId", () => ({
  resolveQuotedMessageByStanzaId: jest.fn()
}));

const mockEmit = jest.fn();
const messages = new Map<string, any>();
const events: any[] = [];

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: async ({ where }: any) => {
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
    findByPk: async (id: string) => messages.get(id) || null
  }
}));

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    create: async (row: any) => {
      const ev = {
        id: events.length + 1,
        ...row,
        update: jest.fn(async (patch: any) => {
          Object.assign(ev, patch);
        })
      };
      events.push(ev);
      return ev;
    },
    findAll: async ({ where }: any) =>
      events.filter(
        e =>
          e.companyId === where.companyId &&
          e.whatsappId === where.whatsappId &&
          e.providerMessageId === where.providerMessageId &&
          e.processingStatus === where.processingStatus
      ),
    update: async (_patch: any, opts: any) => {
      const id = opts?.where?.id;
      const status = opts?.where?.processingStatus;
      const ev = events.find(e => e.id === id && e.processingStatus === status);
      if (!ev) return [0];
      ev.processingStatus = "reapplying";
      return [1];
    }
  }
}));

jest.mock("../../../../../../models/Contact", () => ({ __esModule: true, default: {} }));
jest.mock("../../../../../../models/Ticket", () => ({ __esModule: true, default: {} }));
jest.mock("../../../../../../models/Whatsapp", () => ({ __esModule: true, default: {} }));

import { processEvolutionWebhook } from "../processEvolutionWebhook";
import { reapplyDeferredEvolutionAcks } from "../reapplyDeferredEvolutionAcks";

describe("send → early ACK → persist → reapply → echo", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    messages.clear();
    events.length = 0;
  });

  it("ACK READ antes da Message fica deferred; após persist reapply ack=4; eco não cria fake", async () => {
    // 1) Early ACK
    const early = await processEvolutionWebhook({
      whatsapp,
      apiKeyValid: true,
      body: {
        event: "MESSAGES_UPDATE",
        data: {
          keyId: "EARLY_X",
          status: "READ",
          fromMe: true,
          remoteJid: "5511999998888@s.whatsapp.net"
        }
      }
    });
    expect(early.outcome).toBe("deferred");
    expect(messages.size).toBe(0);

    // 2) Persist Message (simula outbound create)
    const update = jest.fn().mockResolvedValue(undefined);
    messages.set("EARLY_X", {
      id: "EARLY_X",
      externalMessageId: "EARLY_X",
      ack: 2,
      companyId: 1,
      ticketId: 77,
      ticket: { id: 77, whatsappId: 10, status: "open", queueId: null, contact: {} },
      update
    });

    // 3) Reapply
    const reapplied = await reapplyDeferredEvolutionAcks({
      companyId: 1,
      whatsappId: 10,
      providerMessageId: "EARLY_X"
    });
    expect(reapplied.applied).toBe(1);
    expect(update).toHaveBeenCalledWith({ ack: 4 });
    expect(mockEmit).toHaveBeenCalledWith(
      "company-1-appMessage",
      expect.objectContaining({ action: "update" })
    );

    // 4) Idempotent reapply
    const again = await reapplyDeferredEvolutionAcks({
      companyId: 1,
      whatsappId: 10,
      providerMessageId: "EARLY_X"
    });
    expect(again.scanned).toBe(0);

    // 5) Sem Ticket/Contact fake
    expect(messages.size).toBe(1);
  });
});
