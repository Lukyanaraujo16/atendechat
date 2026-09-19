import { AutomationMediaError } from "../../WhatsAppMediaService/AutomationMediaError";
import {
  sendTypebotRemoteMedia,
  trySendTypebotRemoteMedia
} from "../sendTypebotRemoteMedia";
import { persistWhatsAppOutboundMessage } from "../../MessageServices/persistWhatsAppOutboundMessage";

jest.mock("../../MessageServices/persistWhatsAppOutboundMessage", () => ({
  persistWhatsAppOutboundMessage: jest.fn().mockResolvedValue({ id: "P1" })
}));

function outbound(provider: "evolution" | "baileys", sendContent: jest.Mock) {
  return {
    provider,
    sendContent,
    sendText: jest.fn(),
    sendPresence: jest.fn(),
    deleteMessage: jest.fn(),
    markAsRead: jest.fn(),
    getOwnUserJid: () => null
  };
}

describe("sendTypebotRemoteMedia 12.3-F", () => {
  const imgBuf = Buffer.from("img");
  const audioBuf = Buffer.from("ogg");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("imagem URL válida vira Buffer no Evolution sem {url}", async () => {
    const sendContent = jest.fn().mockResolvedValue({ messageId: "I1" });
    const download = jest.fn().mockResolvedValue({
      buffer: imgBuf,
      contentType: "image/png",
      byteLength: imgBuf.length
    });

    await sendTypebotRemoteMedia({
      outbound: outbound("evolution", sendContent) as never,
      jid: "5511999998888@s.whatsapp.net",
      kind: "image",
      url: "https://cdn.typebot.io/x.png",
      caption: "olá",
      deps: { download }
    });

    expect(download).toHaveBeenCalledWith({
      url: "https://cdn.typebot.io/x.png",
      kind: "image"
    });
    expect(sendContent).toHaveBeenCalledTimes(1);
    const { content } = sendContent.mock.calls[0][0];
    expect(Buffer.isBuffer(content.image)).toBe(true);
    expect(content.image).toBe(imgBuf);
    expect(content.mimetype).toBe("image/png");
    expect(content.caption).toBe("olá");
    expect(content.image).not.toEqual({ url: expect.anything() });
    expect(JSON.stringify(content)).not.toMatch(/"url"/);
    expect(persistWhatsAppOutboundMessage).not.toHaveBeenCalled();
  });

  it("imagem continua Buffer no Baileys", async () => {
    const sendContent = jest.fn().mockResolvedValue({ messageId: "B1" });
    await sendTypebotRemoteMedia({
      outbound: outbound("baileys", sendContent) as never,
      jid: "5511@s.whatsapp.net",
      kind: "image",
      url: "https://cdn.typebot.io/x.jpg",
      deps: {
        download: async () => ({
          buffer: imgBuf,
          contentType: "image/jpeg",
          byteLength: 3
        })
      }
    });
    const { content } = sendContent.mock.calls[0][0];
    expect(Buffer.isBuffer(content.image)).toBe(true);
    expect(content.image.url).toBeUndefined();
  });

  it("áudio Evolution usa preparação PTT e não audio/mp4", async () => {
    const sendContent = jest.fn().mockResolvedValue({ messageId: "A1" });
    const preparePtt = jest.fn().mockResolvedValue({
      outputPath: "/tmp/out.ogg",
      mimetype: "audio/ogg; codecs=opus",
      ptt: true
    });
    const writeFileSync = jest.fn();
    const readFileSync = jest.fn().mockReturnValue(audioBuf);
    const unlinkSync = jest.fn();

    await sendTypebotRemoteMedia({
      outbound: outbound("evolution", sendContent) as never,
      jid: "5511999998888@s.whatsapp.net",
      kind: "audio",
      url: "https://cdn.typebot.io/a.mp4",
      deps: {
        download: async () => ({
          buffer: Buffer.from("src"),
          contentType: "audio/mp4",
          byteLength: 3
        }),
        preparePtt,
        writeFileSync: writeFileSync as never,
        readFileSync: readFileSync as never,
        unlinkSync
      }
    });

    expect(preparePtt).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "evolution",
        unlinkSource: true
      })
    );
    const { content } = sendContent.mock.calls[0][0];
    expect(content.ptt).toBe(true);
    expect(content.mimetype).toBe("audio/ogg; codecs=opus");
    expect(content.mimetype).not.toBe("audio/mp4");
    expect(Buffer.isBuffer(content.audio)).toBe(true);
    expect(content.audio.url).toBeUndefined();
  });

  it("áudio Typebot continua funcionando no Baileys", async () => {
    const sendContent = jest.fn().mockResolvedValue({ messageId: "BA" });
    await sendTypebotRemoteMedia({
      outbound: outbound("baileys", sendContent) as never,
      jid: "5511@s.whatsapp.net",
      kind: "audio",
      url: "https://cdn.typebot.io/a.mp4",
      deps: {
        download: async () => ({
          buffer: Buffer.from("src"),
          contentType: "audio/mp4",
          byteLength: 3
        }),
        preparePtt: async () => ({
          outputPath: "/tmp/out.mp3",
          mimetype: "audio/mp4",
          ptt: true as const
        }),
        writeFileSync: jest.fn() as never,
        readFileSync: jest.fn().mockReturnValue(Buffer.from("aac")) as never,
        unlinkSync: jest.fn()
      }
    });
    const { content } = sendContent.mock.calls[0][0];
    expect(content.ptt).toBe(true);
    expect(content.mimetype).toBe("audio/mp4");
  });

  it("falha controlada não propaga crash", async () => {
    const sendContent = jest.fn();
    const ok = await trySendTypebotRemoteMedia({
      outbound: outbound("evolution", sendContent) as never,
      jid: "5511@s.whatsapp.net",
      kind: "image",
      url: "https://cdn.typebot.io/missing.jpg",
      ticketId: 77,
      deps: {
        download: async () => {
          throw new AutomationMediaError("http_status", "HTTP 404", {
            httpStatus: 404
          });
        }
      }
    });
    expect(ok).toBe(false);
    expect(sendContent).not.toHaveBeenCalled();
  });

  it("imagem com ticket persiste o sent do provider", async () => {
    const sent = {
      messageId: "TB-IMG-1",
      remoteJid: "5511999998888@s.whatsapp.net",
      fromMe: true,
      status: 1,
      rawSentMessage: { provider: "evolution", key: { id: "TB-IMG-1" } }
    };
    const sendContent = jest.fn().mockResolvedValue(sent);
    await sendTypebotRemoteMedia({
      outbound: outbound("evolution", sendContent) as never,
      jid: "5511999998888@s.whatsapp.net",
      kind: "image",
      url: "https://cdn.typebot.io/x.png",
      caption: "olá",
      ticket: { id: 77, companyId: 1, whatsappId: 10 },
      deps: {
        download: async () => ({
          buffer: imgBuf,
          contentType: "image/png",
          byteLength: imgBuf.length
        })
      }
    });
    expect(persistWhatsAppOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket: { id: 77, companyId: 1, whatsappId: 10 },
        body: "olá",
        sent,
        mediaType: "image",
        mediaUrl: "https://cdn.typebot.io/x.png"
      })
    );
  });

  it("áudio com ticket persiste mediaType audio e o mesmo provider id", async () => {
    const sent = {
      messageId: "TB-AUD-1",
      remoteJid: "5511999998888@s.whatsapp.net",
      fromMe: true,
      status: 1,
      rawSentMessage: { provider: "evolution", key: { id: "TB-AUD-1" } }
    };
    const sendContent = jest.fn().mockResolvedValue(sent);
    await sendTypebotRemoteMedia({
      outbound: outbound("evolution", sendContent) as never,
      jid: "5511999998888@s.whatsapp.net",
      kind: "audio",
      url: "https://cdn.typebot.io/a.mp4",
      ticket: { id: 77, companyId: 1, whatsappId: 10 },
      deps: {
        download: async () => ({
          buffer: Buffer.from("src"),
          contentType: "audio/mp4",
          byteLength: 3
        }),
        preparePtt: async () => ({
          outputPath: "/tmp/out.ogg",
          mimetype: "audio/ogg; codecs=opus",
          ptt: true as const
        }),
        writeFileSync: jest.fn() as never,
        readFileSync: jest.fn().mockReturnValue(audioBuf) as never,
        unlinkSync: jest.fn()
      }
    });
    expect(persistWhatsAppOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sent,
        mediaType: "audio",
        mediaUrl: "https://cdn.typebot.io/a.mp4",
        body: "-"
      })
    );
  });
});
