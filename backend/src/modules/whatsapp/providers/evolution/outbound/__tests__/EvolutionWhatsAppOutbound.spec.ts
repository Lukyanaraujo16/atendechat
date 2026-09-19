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
  evolutionSendPresence: jest.fn(),
  evolutionDeleteMessage: jest.fn()
}));

import {
  EvolutionWhatsAppOutbound,
  ERR_EVOLUTION_OPERATION_NOT_SUPPORTED,
  ERR_EVOLUTION_INVALID_READ_KEYS,
  ERR_EVOLUTION_INVALID_QUOTED,
  ERR_EVOLUTION_INVALID_PRESENCE
} from "../EvolutionWhatsAppOutbound";
import {
  evolutionSendText,
  evolutionSendMedia,
  evolutionSendWhatsAppAudio,
  evolutionSendSticker,
  evolutionMarkMessageAsRead,
  evolutionSendPresence,
  evolutionDeleteMessage,
  EvolutionHttpError
} from "../../inbound/evolutionHttpClient";
import { jidToEvolutionNumber } from "../evolutionDestination";
import {
  buildEvolutionOutboundDataJson,
  mapEvolutionSendResponseToResult
} from "../mapEvolutionSendResponse";
import { STREAMHUB_ACK } from "../../inbound/mapEvolutionStatusToAck";

const sendText = evolutionSendText as jest.Mock;
const sendMedia = evolutionSendMedia as jest.Mock;
const sendAudio = evolutionSendWhatsAppAudio as jest.Mock;
const sendSticker = evolutionSendSticker as jest.Mock;
const markRead = evolutionMarkMessageAsRead as jest.Mock;
const sendPresenceHttp = evolutionSendPresence as jest.Mock;
const deleteMsg = evolutionDeleteMessage as jest.Mock;

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
    deleteMsg.mockResolvedValue({ message: "Message deleted" });
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
      text: "Olá\nlinha2\u200c",
      quoted: undefined
    });
    expect(result.messageId).toBe("BAE594145F4C59B4");
    expect(result.fromMe).toBe(true);
    expect(result.status).toBe(STREAMHUB_ACK.PENDING);
    expect(typeof result.status).toBe("number");
    expect((result.rawSentMessage as any).provider).toBe("evolution");
    expect((result.rawSentMessage as any).key.id).toBe("BAE594145F4C59B4");
    expect((result.rawSentMessage as any).status).toBe(STREAMHUB_ACK.PENDING);
    expect((result.rawSentMessage as any).status).not.toBe("PENDING");
    expect((result.rawSentMessage as any).providerStatus).toBe("PENDING");
  });

  it("quoted textual semântico envia quoted.key.id sem Baileys", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    await outbound.sendText({
      jid: "5511999998888@s.whatsapp.net",
      text: "reply",
      quoted: {
        stanzaId: "QUOTE_A",
        destinationJid: "5511999998888@s.whatsapp.net",
        isGroup: false,
        fromMe: false,
        body: "original"
      }
    });
    expect(sendText).toHaveBeenCalledWith({
      whatsappId: 10,
      number: "5511999998888@s.whatsapp.net",
      text: "reply",
      quoted: {
        key: {
          id: "QUOTE_A",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false
        },
        message: { conversation: "original" }
      }
    });
  });

  it("quoted sem stanzaId / grupo inbound sem participant falha controlado", async () => {
    const outbound = new EvolutionWhatsAppOutbound(1);
    await expect(
      outbound.sendText({
        jid: "5511@s.whatsapp.net",
        text: "x",
        quoted: { destinationJid: "x", isGroup: false }
      })
    ).rejects.toMatchObject({ message: ERR_EVOLUTION_INVALID_QUOTED });
    await expect(
      outbound.sendText({
        jid: "120363@g.us",
        text: "x",
        quoted: {
          stanzaId: "G1",
          destinationJid: "120363@g.us",
          isGroup: true,
          fromMe: false
        }
      })
    ).rejects.toMatchObject({ message: ERR_EVOLUTION_INVALID_QUOTED });
  });

  it("quoted group inbound envia participant; own outbound omite sem inventar", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    const groupJid = "120363111222333@g.us";
    const inboundParticipant = "5511888777666@s.whatsapp.net";

    await outbound.sendText({
      jid: groupJid,
      text: "reply inbound",
      quoted: {
        stanzaId: "INB_A",
        destinationJid: groupJid,
        isGroup: true,
        fromMe: false,
        participant: inboundParticipant,
        body: "hello group"
      }
    });
    expect(sendText).toHaveBeenLastCalledWith({
      whatsappId: 10,
      number: groupJid,
      text: "reply inbound",
      quoted: {
        key: {
          id: "INB_A",
          remoteJid: groupJid,
          fromMe: false,
          participant: inboundParticipant
        },
        message: { conversation: "hello group" }
      }
    });

    await outbound.sendText({
      jid: groupJid,
      text: "reply own",
      quoted: {
        stanzaId: "OWN_A",
        destinationJid: groupJid,
        isGroup: true,
        fromMe: true,
        participant: null,
        body: "own outbound"
      }
    });
    const ownCall = sendText.mock.calls[sendText.mock.calls.length - 1][0];
    expect(ownCall.number).toBe(groupJid);
    expect(ownCall.quoted).toEqual({
      key: {
        id: "OWN_A",
        remoteJid: groupJid,
        fromMe: true
      },
      message: { conversation: "own outbound" }
    });
    expect(ownCall.quoted.key).not.toHaveProperty("participant");
  });

  it("deleteMessage chama deleteMessageForEveryone sem Baileys", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    await outbound.deleteMessage({
      jid: "5511999998888@s.whatsapp.net",
      target: {
        id: "DEL1",
        remoteJid: "5511999998888@s.whatsapp.net",
        fromMe: true
      }
    });
    expect(deleteMsg).toHaveBeenCalledWith({
      whatsappId: 10,
      id: "DEL1",
      remoteJid: "5511999998888@s.whatsapp.net",
      fromMe: true,
      participant: undefined
    });
  });

  it("delete timeout/API error tipados", async () => {
    const outbound = new EvolutionWhatsAppOutbound(1);
    deleteMsg.mockRejectedValueOnce(
      new EvolutionHttpError("ERR_EVOLUTION_TIMEOUT", "Timeout")
    );
    await expect(
      outbound.deleteMessage({
        jid: "a@s.whatsapp.net",
        target: { id: "1", remoteJid: "a@s.whatsapp.net", fromMe: true }
      })
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_TIMEOUT" });
  });

  it("sticker quoted path ainda sem quoted em sendContent (dívida mídia)", async () => {
    // sendContent sticker não recebe WhatsAppQuotedMessage — documentado.
    expect(ERR_EVOLUTION_OPERATION_NOT_SUPPORTED).toBeTruthy();
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

  it("sendPresence recording continua rejeitado; contrato não inclui recording", async () => {
    const outbound = new EvolutionWhatsAppOutbound(10);
    await expect(
      outbound.sendPresence({
        jid: "5511999998888@s.whatsapp.net",
        presence: "recording" as never
      })
    ).rejects.toMatchObject({
      message: ERR_EVOLUTION_INVALID_PRESENCE
    });
    expect(sendPresenceHttp).not.toHaveBeenCalled();

    const fs = await import("fs");
    const path = await import("path");
    const contract = fs.readFileSync(
      path.join(__dirname, "../../../../outbound/WhatsAppOutbound.ts"),
      "utf8"
    );
    expect(contract).toMatch(
      /export type WhatsAppPresence = "composing" \| "paused" \| "unavailable";/
    );
    expect(contract).not.toMatch(/export type WhatsAppPresence = .*recording/);
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
    expect(img.status).toBe(STREAMHUB_ACK.PENDING);
    expect((img.rawSentMessage as any).status).toBe(1);
    expect((img.rawSentMessage as any).providerStatus).toBe("PENDING");

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

    const audio = await outbound.sendContent({
      jid: "5511999@s.whatsapp.net",
      content: { audio: Buffer.from("ogg"), ptt: true }
    });
    expect(sendAudio).toHaveBeenCalled();
    expect(audio.status).toBe(STREAMHUB_ACK.PENDING);
    expect((audio.rawSentMessage as any).status).not.toBe("PENDING");

    const sticker = await outbound.sendContent({
      jid: "5511999@s.whatsapp.net",
      content: { sticker: Buffer.from("webp") }
    });
    expect(sendSticker).toHaveBeenCalled();
    expect(sticker.status).toBe(STREAMHUB_ACK.PENDING);
    expect((sticker.rawSentMessage as any).status).toBe(1);
  });

  it("sendContent sticker envia base64 + notConvertSticker no contrato 2.3.7", async () => {
    const outbound = new EvolutionWhatsAppOutbound(5);
    const buf = Buffer.from("webp-bytes");
    const result = await outbound.sendContent({
      jid: "5511999@s.whatsapp.net",
      content: { sticker: buf }
    });
    expect(sendSticker).toHaveBeenCalledTimes(1);
    const arg = sendSticker.mock.calls[0][0];
    expect(arg).toEqual({
      whatsappId: 5,
      number: "5511999@s.whatsapp.net",
      sticker: buf.toString("base64"),
      notConvertSticker: true
    });
    expect(Buffer.from(arg.sticker, "base64").equals(buf)).toBe(true);
    expect(JSON.stringify(arg)).not.toMatch(/apikey|apiKey|token|secret/i);
    expect(result.messageId).toBe("STK1");
    expect(result.status).toBe(STREAMHUB_ACK.PENDING);
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

  it("rejeita { image: { url } } e { audio: { url } }", async () => {
    const outbound = new EvolutionWhatsAppOutbound(1);
    await expect(
      outbound.sendContent({
        jid: "5511@s.whatsapp.net",
        content: { image: { url: "https://cdn.example/x.jpg" } }
      })
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_INVALID_MEDIA" });
    await expect(
      outbound.sendContent({
        jid: "5511@s.whatsapp.net",
        content: { audio: { url: "https://cdn.example/a.mp4" } }
      })
    ).rejects.toMatchObject({ message: "ERR_EVOLUTION_INVALID_MEDIA" });
    expect(sendMedia).not.toHaveBeenCalled();
    expect(sendAudio).not.toHaveBeenCalled();
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

  it("PENDING textual → ack 1; dataJson preserva status textual", () => {
    const r = mapEvolutionSendResponseToResult(
      evoResponse("3EB0A7B4504D6340FA95A9"),
      "5511999998888@s.whatsapp.net"
    );
    expect(r.status).toBe(1);
    expect(typeof r.status).toBe("number");
    const envelope = r.rawSentMessage as {
      status: unknown;
      providerStatus: unknown;
    };
    expect(envelope.status).toBe(STREAMHUB_ACK.PENDING);
    expect(envelope.status).not.toBe("PENDING");
    expect(envelope.providerStatus).toBe("PENDING");

    const persistedAck = envelope.status;
    expect(persistedAck).toBe(1);
    expect(JSON.stringify({ ack: persistedAck })).not.toContain("PENDING");

    const dataJson = JSON.parse(buildEvolutionOutboundDataJson(r));
    expect(dataJson.payload.status).toBe("PENDING");
    expect(dataJson.payload.key.id).toBe("3EB0A7B4504D6340FA95A9");
    expect(typeof dataJson.payload.status).toBe("string");
  });
});
