/* eslint-disable import/first */
jest.mock("../../../../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock("@whiskeysockets/baileys", () => ({
  proto: {},
  jidNormalizedUser: (jid: string) => jid
}));

import { BaileysWhatsAppOutbound } from "../BaileysWhatsAppOutbound";

function mockWbot(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "5511000000000:1@s.whatsapp.net" },
    sendMessage: jest.fn().mockResolvedValue({
      key: {
        id: "SENT1",
        remoteJid: "5511999887766@s.whatsapp.net",
        fromMe: true
      },
      status: 1
    }),
    readMessages: jest.fn().mockResolvedValue(undefined),
    sendReceipts: jest.fn().mockResolvedValue(undefined),
    sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
    presenceSubscribe: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("BaileysWhatsAppOutbound", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.WHATSAPP_READ_RECEIPT_PEER_VISIBLE;
    delete process.env.WHATSAPP_READ_RECEIPT_RESPECT_PRIVACY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("sendText preserva o marcador invisível de campanha", async () => {
    const wbot = mockWbot();
    const outbound = new BaileysWhatsAppOutbound(wbot as never);
    await outbound.sendText({
      jid: "5511999887766@s.whatsapp.net",
      text: "\u200c Olá campanha"
    });
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999887766@s.whatsapp.net",
      { text: "\u200c Olá campanha" }
    );
  });

  it("sendText devolve message id fromMe e payload cru", async () => {
    const wbot = mockWbot();
    const outbound = new BaileysWhatsAppOutbound(wbot as never);
    const result = await outbound.sendText({
      jid: "5511999887766@s.whatsapp.net",
      text: "Olá"
    });

    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999887766@s.whatsapp.net",
      { text: "Olá" }
    );
    expect(result.messageId).toBe("SENT1");
    expect(result.fromMe).toBe(true);
    expect(result.remoteJid).toBe("5511999887766@s.whatsapp.net");
    expect((result.rawSentMessage as { key: { id: string } }).key.id).toBe(
      "SENT1"
    );
    expect(outbound.provider).toBe("baileys");
    expect(outbound.getOwnUserJid()).toContain("5511000000000");
  });

  it("sendText com quoted reconstrói dataJson sem alterar stanza", async () => {
    const wbot = mockWbot();
    const outbound = new BaileysWhatsAppOutbound(wbot as never);
    await outbound.sendText({
      jid: "5511999887766@s.whatsapp.net",
      text: "reply",
      quoted: {
        destinationJid: "5511999887766@s.whatsapp.net",
        isGroup: false,
        dataJson: JSON.stringify({
          key: { id: "ORIG", remoteJid: "123@lid", participant: "p1" },
          message: { conversation: "orig" }
        })
      }
    });

    const [, , opts] = wbot.sendMessage.mock.calls[0];
    expect(opts.quoted.key.id).toBe("ORIG");
    expect(opts.quoted.key.remoteJid).toBe("5511999887766@s.whatsapp.net");
    expect(opts.quoted.key.participant).toBeUndefined();
    expect(opts.quoted.message.conversation).toBe("orig");
  });

  it("sendContent envia mídia/áudio/documento/sticker sem redesenhar payload", async () => {
    const wbot = mockWbot();
    const outbound = new BaileysWhatsAppOutbound(wbot as never);
    const image = Buffer.from("img");
    const audio = Buffer.from("ogg");
    const doc = Buffer.from("pdf");
    const sticker = Buffer.from("webp");

    await outbound.sendContent({
      jid: "5511@s.whatsapp.net",
      content: { image, caption: "foto" }
    });
    await outbound.sendContent({
      jid: "5511@s.whatsapp.net",
      content: { audio, mimetype: "audio/mp4", ptt: true }
    });
    await outbound.sendContent({
      jid: "5511@s.whatsapp.net",
      content: { document: doc, fileName: "a.pdf", mimetype: "application/pdf" }
    });
    await outbound.sendContent({
      jid: "5511@s.whatsapp.net",
      content: { sticker }
    });

    expect(wbot.sendMessage).toHaveBeenNthCalledWith(1, "5511@s.whatsapp.net", {
      image,
      caption: "foto"
    });
    expect(wbot.sendMessage).toHaveBeenNthCalledWith(2, "5511@s.whatsapp.net", {
      audio,
      mimetype: "audio/mp4",
      ptt: true
    });
    expect(wbot.sendMessage).toHaveBeenNthCalledWith(3, "5511@s.whatsapp.net", {
      document: doc,
      fileName: "a.pdf",
      mimetype: "application/pdf"
    });
    expect(wbot.sendMessage).toHaveBeenNthCalledWith(4, "5511@s.whatsapp.net", {
      sticker
    });
    const stickerCall = wbot.sendMessage.mock.calls[3][1];
    expect(stickerCall).toEqual({ sticker });
    expect(stickerCall).not.toHaveProperty("notConvertSticker");
  });

  it("deleteMessage usa remoteJid, id e fromMe atuais", async () => {
    const wbot = mockWbot();
    const outbound = new BaileysWhatsAppOutbound(wbot as never);
    await outbound.deleteMessage({
      jid: "5511@s.whatsapp.net",
      target: {
        id: "MSG1",
        remoteJid: "5511@s.whatsapp.net",
        participant: null,
        fromMe: true
      }
    });
    expect(wbot.sendMessage).toHaveBeenCalledWith("5511@s.whatsapp.net", {
      delete: {
        id: "MSG1",
        remoteJid: "5511@s.whatsapp.net",
        participant: null,
        fromMe: true
      }
    });
  });

  it("markAsRead usa readMessages por omissão", async () => {
    const wbot = mockWbot();
    const outbound = new BaileysWhatsAppOutbound(wbot as never);
    await outbound.markAsRead([
      {
        remoteJid: "5511@s.whatsapp.net",
        id: "IN1",
        fromMe: false
      }
    ]);
    expect(wbot.readMessages).toHaveBeenCalledTimes(1);
    expect(wbot.sendReceipts).not.toHaveBeenCalled();
    expect(wbot.readMessages.mock.calls[0][0][0].id).toBe("IN1");
  });

  it("markAsRead usa sendReceipts quando PEER_VISIBLE=true", async () => {
    process.env.WHATSAPP_READ_RECEIPT_PEER_VISIBLE = "true";
    const wbot = mockWbot();
    const outbound = new BaileysWhatsAppOutbound(wbot as never);
    await outbound.markAsRead([
      { remoteJid: "5511@s.whatsapp.net", id: "IN2", fromMe: false }
    ]);
    expect(wbot.sendReceipts).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "IN2", fromMe: false })],
      "read"
    );
    expect(wbot.readMessages).not.toHaveBeenCalled();
  });

  it("sendPresence composing subscreve e envia composing", async () => {
    const wbot = mockWbot();
    const outbound = new BaileysWhatsAppOutbound(wbot as never);
    const ok = await outbound.sendPresence({
      jid: "5511@s.whatsapp.net",
      presence: "composing",
      subscribe: true
    });
    expect(ok).toBe(true);
    expect(wbot.presenceSubscribe).toHaveBeenCalledWith("5511@s.whatsapp.net");
    expect(wbot.sendPresenceUpdate).toHaveBeenCalledWith(
      "composing",
      "5511@s.whatsapp.net"
    );
  });
});
