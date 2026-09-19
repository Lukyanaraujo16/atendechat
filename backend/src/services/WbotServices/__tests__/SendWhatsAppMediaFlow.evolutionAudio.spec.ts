/* eslint-disable import/first */
import fs from "fs";
import path from "path";

const sendContent = jest.fn();
const getOutbound = jest.fn();
const preparePtt = jest.fn();
const mimeLookup = jest.fn();
const ticketUpdate = jest.fn();

jest.mock("@ffmpeg-installer/ffmpeg", () => ({
  path: "/bin/echo"
}));

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (jid: string) => jid
}));

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: (...a: unknown[]) => getOutbound(...a)
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: jest
    .fn()
    .mockResolvedValue("5511999998888@s.whatsapp.net")
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));

jest.mock("mime-types", () => ({
  lookup: (...a: unknown[]) => mimeLookup(...a)
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn((p: string) => Buffer.from(String(p)))
}));

jest.mock("../../WhatsAppMediaService/prepareWhatsAppPttAudio", () => ({
  prepareWhatsAppPttAudio: (...a: unknown[]) => preparePtt(...a)
}));

import SendWhatsAppMediaFlow from "../SendWhatsAppMediaFlow";

function ticket() {
  return {
    id: 77,
    isGroup: false,
    contactId: 5,
    update: ticketUpdate
  };
}

describe("SendWhatsAppMediaFlow 12.3-F automation media", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ticketUpdate.mockResolvedValue(undefined);
    sendContent.mockResolvedValue({
      rawSentMessage: { key: { id: "M1" } }
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((p: string) =>
      Buffer.from(String(p))
    );
  });

  it("imagem Buffer envia no Evolution", async () => {
    mimeLookup.mockReturnValue("image/jpeg");
    getOutbound.mockResolvedValue({ provider: "evolution", sendContent });
    await SendWhatsAppMediaFlow({
      media: "/tmp/foto.jpg",
      ticket: ticket() as never,
      body: "legenda",
      isFlow: true
    });
    expect(sendContent).toHaveBeenCalledTimes(1);
    const { content } = sendContent.mock.calls[0][0];
    expect(Buffer.isBuffer(content.image)).toBe(true);
    expect(content.caption).toBe("legenda");
    expect(content.fileName).toBeUndefined();
  });

  it("vídeo Buffer envia no Evolution sem filename como caption", async () => {
    mimeLookup.mockReturnValue("video/mp4");
    getOutbound.mockResolvedValue({ provider: "evolution", sendContent });
    await SendWhatsAppMediaFlow({
      media: "/tmp/clip.mp4",
      ticket: ticket() as never,
      body: "video cap",
      isFlow: true
    });
    const { content } = sendContent.mock.calls[0][0];
    expect(Buffer.isBuffer(content.video)).toBe(true);
    expect(content.caption).toBe("video cap");
    expect(content.caption).not.toBe("clip");
    expect(content.fileName).toBeUndefined();
  });

  it("documento Buffer preserva filename no Evolution", async () => {
    mimeLookup.mockReturnValue("application/pdf");
    getOutbound.mockResolvedValue({ provider: "evolution", sendContent });
    await SendWhatsAppMediaFlow({
      media: "/tmp/contrato.pdf",
      ticket: ticket() as never,
      body: "doc cap",
      isFlow: true
    });
    const { content } = sendContent.mock.calls[0][0];
    expect(Buffer.isBuffer(content.document)).toBe(true);
    expect(content.fileName).toBe("contrato.pdf");
    expect(content.mimetype).toBe("application/pdf");
    expect(content.caption).toBe("doc cap");
  });

  it("áudio Flow é preparado para Evolution com ptt", async () => {
    mimeLookup.mockReturnValue("audio/mpeg");
    preparePtt.mockResolvedValue({
      outputPath: "/tmp/out.ogg",
      mimetype: "audio/ogg; codecs=opus",
      ptt: true
    });
    getOutbound.mockResolvedValue({ provider: "evolution", sendContent });
    await SendWhatsAppMediaFlow({
      media: "/tmp/voice.mp3",
      ticket: ticket() as never,
      isFlow: true,
      isRecord: true
    });
    expect(preparePtt).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: path.resolve("/tmp/voice.mp3"),
        provider: "evolution",
        unlinkSource: false
      })
    );
    const { content } = sendContent.mock.calls[0][0];
    expect(content.ptt).toBe(true);
    expect(content.mimetype).toBe("audio/ogg; codecs=opus");
    expect(content.mimetype).not.toBe("audio/mp4");
    expect(Buffer.isBuffer(content.audio)).toBe(true);
  });

  it("áudio Flow continua funcionando no Baileys", async () => {
    mimeLookup.mockReturnValue("audio/mpeg");
    preparePtt.mockResolvedValue({
      outputPath: "/tmp/out.mp3",
      mimetype: "audio/mp4",
      ptt: true
    });
    getOutbound.mockResolvedValue({ provider: "baileys", sendContent });
    await SendWhatsAppMediaFlow({
      media: "/tmp/voice.mp3",
      ticket: ticket() as never,
      isFlow: true,
      isRecord: true
    });
    expect(preparePtt).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "baileys" })
    );
    const { content } = sendContent.mock.calls[0][0];
    expect(content.ptt).toBe(true);
    expect(content.mimetype).toBe("audio/mp4");
    expect(sendContent).toHaveBeenCalled();
  });

  it("Flow não chama getWbot para mídia provider-neutral", () => {
    const real = jest.requireActual("fs") as typeof fs;
    const text = real.readFileSync(
      path.join(__dirname, "../SendWhatsAppMediaFlow.ts"),
      "utf8"
    );
    expect(text).not.toMatch(/\bgetWbot\s*\(/);
    expect(text).not.toMatch(/GetTicketWbot/);
    expect(text).not.toMatch(/GetWhatsappWbot/);
    expect(text).not.toMatch(/wrapBaileysSession/);
  });
});
