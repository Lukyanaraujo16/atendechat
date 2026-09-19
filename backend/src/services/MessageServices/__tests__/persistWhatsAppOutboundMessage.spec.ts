import { v4 as uuidv4 } from "uuid";
import CreateMessageService from "../CreateMessageService";
import { scheduleReapplyDeferredEvolutionAcks } from "../../../modules/whatsapp/providers/evolution/inbound/reapplyDeferredEvolutionAcks";
import {
  persistWhatsAppOutboundMessage,
  resolveWhatsAppOutboundPersistIdentity
} from "../persistWhatsAppOutboundMessage";
import { buildEvolutionOutboundDataJsonFromEnvelope } from "../../../modules/whatsapp/providers/evolution/outbound/mapEvolutionSendResponse";

jest.mock("../CreateMessageService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("uuid", () => ({
  v4: jest.fn(() => "generated-uuid")
}));

jest.mock(
  "../../../modules/whatsapp/providers/evolution/inbound/reapplyDeferredEvolutionAcks",
  () => ({
    scheduleReapplyDeferredEvolutionAcks: jest.fn()
  })
);

const createMessage = CreateMessageService as jest.Mock;
const uuid = uuidv4 as jest.Mock;
const scheduleAcks = scheduleReapplyDeferredEvolutionAcks as jest.Mock;

const ticket = {
  id: 77,
  companyId: 1,
  whatsappId: 3
};

function evolutionEnvelope(id = "BAE594145F4C59B4") {
  return {
    provider: "evolution",
    key: {
      id,
      remoteJid: "5511999998888@s.whatsapp.net",
      fromMe: true
    },
    status: 1,
    providerStatus: "PENDING",
    messageId: id,
    remoteJid: "5511999998888@s.whatsapp.net",
    fromMe: true
  };
}

function baileysWaMessage(id = "BAILEYS1") {
  return {
    key: {
      id,
      remoteJid: "5511999998888@s.whatsapp.net",
      fromMe: true
    },
    status: 1,
    message: { conversation: "oi" }
  };
}

describe("persistWhatsAppOutboundMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMessage.mockResolvedValue({ id: "BAE594145F4C59B4" });
  });

  it("Evolution envelope: id = key.id, externalMessageId, dataJson canônico, ACK deferido", async () => {
    const envelope = evolutionEnvelope();
    await persistWhatsAppOutboundMessage({
      ticket,
      body: "Bem-vindo",
      sent: envelope
    });

    expect(uuid).not.toHaveBeenCalled();
    expect(createMessage).toHaveBeenCalledTimes(1);
    const payload = createMessage.mock.calls[0][0];
    expect(payload.companyId).toBe(1);
    expect(payload.messageData).toEqual(
      expect.objectContaining({
        id: "BAE594145F4C59B4",
        ticketId: 77,
        body: "Bem-vindo",
        fromMe: true,
        read: true,
        ack: 1,
        mediaType: "conversation",
        remoteJid: "5511999998888@s.whatsapp.net",
        externalMessageId: "BAE594145F4C59B4",
        dataJson: buildEvolutionOutboundDataJsonFromEnvelope(envelope)
      })
    );
    expect(scheduleAcks).toHaveBeenCalledWith({
      companyId: 1,
      whatsappId: 3,
      providerMessageId: "BAE594145F4C59B4"
    });
  });

  it("WhatsAppOutboundSendResult Evolution usa messageId do result, sem UUID", async () => {
    const envelope = evolutionEnvelope("EVO-SEND-1");
    await persistWhatsAppOutboundMessage({
      ticket,
      body: "menu",
      sent: {
        messageId: "EVO-SEND-1",
        remoteJid: "5511999998888@s.whatsapp.net",
        fromMe: true,
        status: 1,
        rawSentMessage: envelope
      }
    });

    expect(uuid).not.toHaveBeenCalled();
    expect(createMessage.mock.calls[0][0].messageData.id).toBe("EVO-SEND-1");
    expect(createMessage.mock.calls[0][0].messageData.externalMessageId).toBe(
      "EVO-SEND-1"
    );
  });

  it("Baileys WAMessage usa key.id e não gera UUID", async () => {
    await persistWhatsAppOutboundMessage({
      ticket,
      body: "Olá",
      sent: baileysWaMessage("3EB0BAILEYSID")
    });

    expect(uuid).not.toHaveBeenCalled();
    expect(createMessage.mock.calls[0][0].messageData).toEqual(
      expect.objectContaining({
        id: "3EB0BAILEYSID",
        fromMe: true,
        externalMessageId: undefined
      })
    );
    expect(scheduleAcks).not.toHaveBeenCalled();
  });

  it("eco posterior com o mesmo provider id reusa Message.id (upsert, sem segunda linha)", async () => {
    const envelope = evolutionEnvelope("SAME-ID");
    await persistWhatsAppOutboundMessage({
      ticket,
      body: "a",
      sent: envelope
    });
    await persistWhatsAppOutboundMessage({
      ticket,
      body: "a",
      sent: envelope
    });

    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(createMessage.mock.calls[0][0].messageData.id).toBe("SAME-ID");
    expect(createMessage.mock.calls[1][0].messageData.id).toBe("SAME-ID");
  });

  it("Baileys eco posterior com o mesmo key.id reusa Message.id", async () => {
    const wa = baileysWaMessage("ECHO-1");
    await persistWhatsAppOutboundMessage({ ticket, body: "x", sent: wa });
    await persistWhatsAppOutboundMessage({ ticket, body: "x", sent: wa });
    expect(createMessage.mock.calls[0][0].messageData.id).toBe("ECHO-1");
    expect(createMessage.mock.calls[1][0].messageData.id).toBe("ECHO-1");
  });

  it("quotedMsgId é preservado", async () => {
    await persistWhatsAppOutboundMessage({
      ticket,
      body: "resposta",
      sent: evolutionEnvelope("Q1"),
      quotedMsgId: "INBOUND-9"
    });
    expect(createMessage.mock.calls[0][0].messageData.quotedMsgId).toBe(
      "INBOUND-9"
    );
  });

  it("mediaType e mediaUrl de mídia outbound não viram conversation", async () => {
    const envelope = evolutionEnvelope("IMG-1");
    await persistWhatsAppOutboundMessage({
      ticket,
      body: "foto.jpg",
      sent: {
        messageId: "IMG-1",
        remoteJid: "5511999998888@s.whatsapp.net",
        fromMe: true,
        status: 1,
        rawSentMessage: envelope
      },
      mediaType: "image",
      mediaUrl: "foto.jpg"
    });
    expect(createMessage.mock.calls[0][0].messageData).toEqual(
      expect.objectContaining({
        id: "IMG-1",
        fromMe: true,
        mediaType: "image",
        mediaUrl: "foto.jpg",
        body: "foto.jpg"
      })
    );
    expect(uuid).not.toHaveBeenCalled();
  });

  it("UUID só quando não há provider id", async () => {
    await persistWhatsAppOutboundMessage({
      ticket,
      body: "fallback",
      sent: { key: { remoteJid: "x@s.whatsapp.net" } }
    });
    expect(uuid).toHaveBeenCalledTimes(1);
    expect(createMessage.mock.calls[0][0].messageData.id).toBe(
      "generated-uuid"
    );
  });

  it("sent null não persiste", async () => {
    const saved = await persistWhatsAppOutboundMessage({
      ticket,
      body: "x",
      sent: null
    });
    expect(saved).toBeNull();
    expect(createMessage).not.toHaveBeenCalled();
  });
});

describe("resolveWhatsAppOutboundPersistIdentity", () => {
  it("não inventa id quando key.id existe", () => {
    const identity = resolveWhatsAppOutboundPersistIdentity(
      evolutionEnvelope("KEEP-ME")
    );
    expect(identity.messageId).toBe("KEEP-ME");
    expect(identity.isEvolution).toBe(true);
  });
});
