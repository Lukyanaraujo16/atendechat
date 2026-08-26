/* eslint-disable import/first */
jest.mock("../../inbound/evolutionHttpClient", () => ({
  EvolutionHttpError: class EvolutionHttpError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  evolutionSendText: jest.fn(),
  evolutionSendMedia: jest.fn(),
  evolutionSendWhatsAppAudio: jest.fn(),
  evolutionSendSticker: jest.fn(),
  evolutionMarkMessageAsRead: jest.fn(),
  evolutionSendPresence: jest.fn()
}));

import {
  EvolutionWhatsAppOutbound,
  ERR_EVOLUTION_OPERATION_NOT_SUPPORTED,
  ERR_EVOLUTION_INVALID_READ_KEYS
} from "../EvolutionWhatsAppOutbound";
import {
  evolutionSendText,
  evolutionSendMedia,
  evolutionSendWhatsAppAudio,
  evolutionSendSticker,
  evolutionMarkMessageAsRead,
  evolutionSendPresence,
  EvolutionHttpError
} from "../../inbound/evolutionHttpClient";
import { jidToEvolutionNumber } from "../evolutionDestination";
import { mapEvolutionSendResponseToResult } from "../mapEvolutionSendResponse";

const sendText = evolutionSendText as jest.Mock;
const sendMedia = evolutionSendMedia as jest.Mock;
const sendAudio = evolutionSendWhatsAppAudio as jest.Mock;
const sendSticker = evolutionSendSticker as jest.Mock;
const markRead = evolutionMarkMessageAsRead as jest.Mock;
const sendPresenceHttp = evolutionSendPresence as jest.Mock;

const evoResponse = (id = "BAE594145F4C59B4") => ({
  key: {
    remoteJid: "5511999998888@s.whatsapp.net",
    fromMe: true,
    id
  },
  messageTimestamp: "1717689097",
  status: "PENDING"
});

describe("EvolutionWhatsAppOutbound Fase 8", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendText.mockResolvedValue(evoResponse());
    sendMedia.mockResolvedValue(evoResponse("IMG1"));
    sendAudio.mockResolvedValue(evoResponse("AUD1"));
    sendSticker.mockResolvedValue(evoResponse("STK1"));
    markRead.mockResolvedValue({ message: "Read messages", read: "success" });
    sendPresenceHttp.mockResolvedValue({});
  });

  it("sendText chama endpoint com number/text e retorna message id", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    const result = await outbound.sendText({
      jid: "5511999998888@s.whatsapp.net",
      text: "Olá\nlinha2\u200c"
    });
    expect(sendText).toHaveBeenCalledWith({
      whatsappId: 10,
      number: "5511999998888@s.whatsapp.net",
      text: "Olá\nlinha2\u200c"
    });
    expect(result.messageId).toBe("BAE594145F4C59B4");
    expect(result.fromMe).toBe(true);
    expect((result.rawSentMessage as any).provider).toBe("evolution");
    expect((result.rawSentMessage as any).key.id).toBe("BAE594145F4C59B4");
  });

  it("quoted retorna NOT_SUPPORTED", async () => {
    const outbound = new EvolutionWhatsAppOutbound(1);
    await expect(
      outbound.sendText({
        jid: "5511@s.whatsapp.net",
        text: "x",
        quoted: { dataJson: "{}", destinationJid: "x", isGroup: false }
      })
    ).rejects.toMatchObject({ message: ERR_EVOLUTION_OPERATION_NOT_SUPPORTED });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("delete não faz fallback Baileys", async () => {
    const outbound = new EvolutionWhatsAppOutbound(1);
    await expect(
      outbound.deleteMessage({
        jid: "x",
        target: { id: "1", remoteJid: "x", fromMe: true }
      })
    ).rejects.toMatchObject({ message: ERR_EVOLUTION_OPERATION_NOT_SUPPORTED });
  });

  it("markAsRead chama markMessageAsRead com remote/message ids", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    await outbound.markAsRead([
      {
        remoteJid: "5511999998888@s.whatsapp.net",
        id: "INB1",
        fromMe: false
      }
    ]);
    expect(markRead).toHaveBeenCalledWith({
      whatsappId: 10,
      readMessages: [
        {
          remoteJid: "5511999998888@s.whatsapp.net",
          id: "INB1",
          fromMe: false
        }
      ]
    });
  });

  it("markAsRead keys vazias / timeout / API error", async () => {
    const outbound = new EvolutionWhatsAppOutbound(1);
    await expect(outbound.markAsRead([])).rejects.toMatchObject({
      message: ERR_EVOLUTION_INVALID_READ_KEYS
    });
    markRead.mockRejectedValueOnce(
      new EvolutionHttpError("ERR_EVOLUTION_TIMEOUT", "Timeout")
    );
    await expect(
      outbound.markAsRead([
        { remoteJid: "a@s.whatsapp.net", id: "1", fromMe: false }
      ])
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_TIMEOUT" });
    markRead.mockRejectedValueOnce(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "fail")
    );
    await expect(
      outbound.markAsRead([
        { remoteJid: "a@s.whatsapp.net", id: "1", fromMe: false }
      ])
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_API_ERROR" });
  });

  it("sendPresence composing/paused; sem jid → false; sem Baileys", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    await expect(
      outbound.sendPresence({ presence: "composing" })
    ).resolves.toBe(false);
    expect(sendPresenceHttp).not.toHaveBeenCalled();

    await expect(
      outbound.sendPresence({
        jid: "5511999998888@s.whatsapp.net",
        presence: "composing"
      })
    ).resolves.toBe(true);
    expect(sendPresenceHttp).toHaveBeenCalledWith({
      whatsappId: 10,
      number: "5511999998888@s.whatsapp.net",
      presence: "composing",
      delay: 5000
    });

    await outbound.sendPresence({
      jid: "5511999998888@s.whatsapp.net",
      presence: "paused"
    });
    expect(sendPresenceHttp).toHaveBeenLastCalledWith(
      expect.objectContaining({ presence: "paused", delay: 1000 })
    );
  });

  it("timeout/API error tipados", async () => {
    const outbound = new EvolutionWhatsAppOutbound(1);
    sendText.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_TIMEOUT", "timeout")
    );
    await expect(
      outbound.sendText({ jid: "5511@s.whatsapp.net", text: "x" })
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_TIMEOUT" });

    sendText.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "Unauthorized")
    );
    await expect(
      outbound.sendText({ jid: "5511@s.whatsapp.net", text: "x" })
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_API_ERROR" });
  });

  it("resposta sem message id falha", async () => {
    sendText.mockResolvedValue({ key: { fromMe: true } });
    const outbound = new EvolutionWhatsAppOutbound(1);
    await expect(
      outbound.sendText({ jid: "5511@s.whatsapp.net", text: "x" })
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_INVALID_RESPONSE" });
  });

  it("image/video/document/audio/PTT/sticker via sendContent", async () => {
    const outbound = new EvolutionWhatsAppOutbound(5);
    const img = await outbound.sendContent({
      jid: "5511999@s.whatsapp.net",
      content: {
        image: Buffer.from("img"),
        caption: "cap",
        mimetype: "image/jpeg"
      }
    });
    expect(sendMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        mediatype: "image",
        caption: "cap",
        media: Buffer.from("img").toString("base64")
      })
    );
    expect(img.messageId).toBe("IMG1");

    await outbound.sendContent({
      jid: "5511999@s.whatsapp.net",
      content: { video: Buffer.from("vid"), caption: "v" }
    });
    expect(sendMedia).toHaveBeenCalledWith(
      expect.objectContaining({ mediatype: "video" })
    );

    await outbound.sendContent({
      jid: "5511999@s.whatsapp.net",
      content: {
        document: Buffer.from("%PDF"),
        fileName: "a.pdf",
        mimetype: "application/pdf"
      }
    });
    expect(sendMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        mediatype: "document",
        fileName: "a.pdf"
      })
    );

    await outbound.sendContent({
      jid: "5511999@s.whatsapp.net",
      content: { audio: Buffer.from("ogg"), ptt: true }
    });
    expect(sendAudio).toHaveBeenCalled();

    await outbound.sendContent({
      jid: "5511999@s.whatsapp.net",
      content: { sticker: Buffer.from("webp") }
    });
    expect(sendSticker).toHaveBeenCalled();
  });

  it("media too large", async () => {
    const outbound = new EvolutionWhatsAppOutbound(1);
    const big = Buffer.alloc(9 * 1024 * 1024, 1);
    await expect(
      outbound.sendContent({
        jid: "5511@s.whatsapp.net",
        content: { image: big }
      })
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_MEDIA_TOO_LARGE" });
  });
});

describe("evolutionDestination / mapEvolutionSendResponse", () => {
  it("converte JID e dígitos", () => {
    expect(jidToEvolutionNumber("5511999@s.whatsapp.net")).toBe(
      "5511999@s.whatsapp.net"
    );
    expect(jidToEvolutionNumber("55 11 9999")).toBe("55119999");
  });

  it("mapeia key.id", () => {
    const r = mapEvolutionSendResponseToResult(evoResponse("X1"), "jid");
    expect(r.messageId).toBe("X1");
    expect(r.remoteJid).toContain("5511");
  });
});
