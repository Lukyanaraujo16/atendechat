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

const persistOutbound = jest.fn();
jest.mock("../../MessageServices/persistWhatsAppOutboundMessage", () => ({
  persistWhatsAppOutboundMessage: (...a: unknown[]) => persistOutbound(...a)
}));

import SendWhatsAppMediaFlow, {
  typeSimulation
} from "../SendWhatsAppMediaFlow";

function ticket() {
  return {
    id: 77,
    companyId: 1,
    whatsappId: 10,
    isGroup: false,
    contactId: 5,
    update: ticketUpdate
  };
}

function sentResult(id: string) {
  return {
    messageId: id,
    remoteJid: "5511999998888@s.whatsapp.net",
    fromMe: true,
    status: 1,
    rawSentMessage: {
      provider: "evolution",
      key: { id, remoteJid: "5511999998888@s.whatsapp.net", fromMe: true }
    }
  };
}

describe("SendWhatsAppMediaFlow 12.3-F automation media", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ticketUpdate.mockResolvedValue(undefined);
    persistOutbound.mockResolvedValue({ id: "M1" });
    sendContent.mockResolvedValue(sentResult("M1"));
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
    expect(persistOutbound).toHaveBeenCalledTimes(1);
    expect(persistOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket: expect.objectContaining({ id: 77, companyId: 1 }),
        body: "legenda",
        sent: expect.objectContaining({ messageId: "M1" }),
        mediaType: "image",
        mediaUrl: "foto.jpg"
      })
    );
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
    expect(persistOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        sent: expect.objectContaining({ messageId: "M1" }),
        mediaType: "video",
        mediaUrl: "clip.mp4",
        body: "video cap"
      })
    );
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
    expect(persistOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        sent: expect.objectContaining({ messageId: "M1" }),
        mediaType: "document",
        mediaUrl: "contrato.pdf",
        body: "doc cap"
      })
    );
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
    expect(persistOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        sent: expect.objectContaining({ messageId: "M1" }),
        mediaType: "audio",
        mediaUrl: "voice.mp3"
      })
    );
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
    expect(persistOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        sent: expect.objectContaining({ messageId: "M1" }),
        mediaType: "audio"
      })
    );
  });

  it("imagem sem body persiste filename e não inventa caption no WhatsApp", async () => {
    mimeLookup.mockReturnValue("image/jpeg");
    getOutbound.mockResolvedValue({ provider: "evolution", sendContent });
    await SendWhatsAppMediaFlow({
      media: "/tmp/flow-img.png",
      ticket: ticket() as never,
      body: "",
      isFlow: true
    });
    const { content } = sendContent.mock.calls[0][0];
    expect(content.caption).toBe("");
    expect(persistOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "flow-img.png",
        mediaType: "image",
        mediaUrl: "flow-img.png",
        sent: expect.objectContaining({ messageId: "M1" })
      })
    );
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

  it("typeSimulation usa WhatsAppPresence e não WAPresence/cast", () => {
    const real = jest.requireActual("fs") as typeof fs;
    const text = real.readFileSync(
      path.join(__dirname, "../SendWhatsAppMediaFlow.ts"),
      "utf8"
    );
    expect(text).toMatch(/presence: WhatsAppPresence/);
    expect(text).not.toMatch(/\bWAPresence\b/);
    expect(text).not.toMatch(
      /presence as "composing" \| "paused" \| "unavailable"/
    );
  });

  it("typeSimulation envia composing e depois paused", async () => {
    const sendPresence = jest.fn().mockResolvedValue(true);
    getOutbound.mockResolvedValue({
      provider: "evolution",
      sendContent,
      sendPresence
    });
    const timer = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((fn: TimerHandler) => {
        if (typeof fn === "function") fn();
        return 0 as unknown as NodeJS.Timeout;
      });
    try {
      await typeSimulation(ticket() as never, "composing");
      expect(sendPresence).toHaveBeenNthCalledWith(1, {
        jid: "5511999998888@s.whatsapp.net",
        presence: "composing",
        subscribe: false
      });
      expect(sendPresence).toHaveBeenNthCalledWith(2, {
        jid: "5511999998888@s.whatsapp.net",
        presence: "paused"
      });
      expect(sendContent).not.toHaveBeenCalled();
    } finally {
      timer.mockRestore();
    }
  });

  it("não persiste se sendContent falha (FIX4 intacto)", async () => {
    mimeLookup.mockReturnValue("image/jpeg");
    sendContent.mockRejectedValue(new Error("transport fail"));
    getOutbound.mockResolvedValue({ provider: "evolution", sendContent });
    await expect(
      SendWhatsAppMediaFlow({
        media: "/tmp/foto.jpg",
        ticket: ticket() as never,
        body: "legenda",
        isFlow: true
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining("ERR_SENDING_WAPP_MSG")
    });
    expect(persistOutbound).not.toHaveBeenCalled();
  });
});
