/* eslint-disable import/first */
const sendContent = jest.fn();
const createMessage = jest.fn();
const incrementStorage = jest.fn();
const scheduleReapply = jest.fn();
const getRemoteJid = jest.fn();
const getOutbound = jest.fn();
const execMock = jest.fn();
const unlinkSync = jest.fn();
const readFileSync = jest.fn((p: unknown) => {
  const s = String(p);
  if (s.endsWith(".ogg")) return Buffer.from("ogg-opus");
  if (s.endsWith(".mp3")) return Buffer.from("aac-mp4");
  return Buffer.from("img");
});

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: (...a: unknown[]) => getOutbound(...a)
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: (...a: unknown[]) => getRemoteJid(...a)
}));

jest.mock("../../../helpers/Mustache", () => ({
  __esModule: true,
  default: (body?: string) => body || ""
}));

jest.mock("../../MessageServices/CreateMessageService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => createMessage(...a)
}));

jest.mock("../../CompanyService/adjustCompanyStorageUsage", () => ({
  incrementCompanyStorageUsage: (...a: unknown[]) => incrementStorage(...a),
  tryStatFileBytes: () => 1024
}));

jest.mock(
  "../../../modules/whatsapp/providers/evolution/inbound/reapplyDeferredEvolutionAcks",
  () => ({
    scheduleReapplyDeferredEvolutionAcks: (...a: unknown[]) =>
      scheduleReapply(...a)
  })
);

jest.mock("../../../models/Ticket", () => ({ __esModule: true, default: {} }));
jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));
jest.mock("@ffmpeg-installer/ffmpeg", () => ({ path: "/usr/bin/ffmpeg" }));

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (j: string) => j
}));

jest.mock("child_process", () => ({
  exec: (...a: unknown[]) => execMock(...a)
}));

jest.mock("fs", () => ({
  readFileSync: (p: string) => readFileSync(p),
  unlinkSync: (p: string) => unlinkSync(p)
}));

import SendWhatsAppMedia from "../SendWhatsAppMedia";
import { STREAMHUB_ACK } from "../../../modules/whatsapp/providers/evolution/inbound/mapEvolutionStatusToAck";
import { buildEvolutionOutboundDataJsonFromEnvelope } from "../../../modules/whatsapp/providers/evolution/outbound/mapEvolutionSendResponse";

function ticketRow() {
  return {
    id: 3,
    companyId: 1,
    whatsappId: 3,
    isGroup: false,
    contact: { number: "5511999998888" },
    update: jest.fn().mockResolvedValue(undefined)
  };
}

function imageMedia() {
  return {
    path: "/tmp/foto.jpg",
    filename: "1710000000000_foto.jpg",
    originalname: "foto.jpg",
    mimetype: "image/jpeg"
  } as Express.Multer.File;
}

function siteVoiceMedia() {
  return {
    path: "/public/1788473643211_audio-record-site-1788473642919.webm",
    filename: "1788473643211_audio-record-site-1788473642919.webm",
    originalname: "audio-record-site-1788473642919.webm",
    mimetype: "audio/webm"
  } as Express.Multer.File;
}

function fileAudioMedia() {
  return {
    path: "/public/nota.mp3",
    filename: "1710000000000_nota.mp3",
    originalname: "nota.mp3",
    mimetype: "audio/mpeg"
  } as Express.Multer.File;
}

function evolutionSent(id: string) {
  const rawSentMessage = {
    provider: "evolution",
    key: {
      id,
      remoteJid: "5511999998888@s.whatsapp.net",
      fromMe: true
    },
    status: STREAMHUB_ACK.PENDING,
    providerStatus: "PENDING"
  };
  return {
    rawSentMessage,
    result: {
      messageId: id,
      status: STREAMHUB_ACK.PENDING,
      rawSentMessage
    }
  };
}

function mockEvolutionOutbound() {
  getOutbound.mockResolvedValue({
    provider: "evolution",
    getOwnUserJid: () => "evolution:3",
    sendContent: (...a: unknown[]) => sendContent(...a)
  });
}

function mockBaileysOutbound() {
  getOutbound.mockResolvedValue({
    provider: "baileys",
    getOwnUserJid: () => "5511@s.whatsapp.net",
    sendContent: (...a: unknown[]) => sendContent(...a)
  });
}

describe("SendWhatsAppMedia Evolution outbound persist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEvolutionOutbound();
    getRemoteJid.mockResolvedValue("5511999998888@s.whatsapp.net");
    createMessage.mockResolvedValue({ id: "3EB0C4A72C3DE1925708C6" });
    incrementStorage.mockResolvedValue(undefined);
    execMock.mockImplementation((_cmd: string, cb: (err: null) => void) =>
      cb(null)
    );
  });

  it("persiste mídia Evolution com ack numérico, mediaUrl e normalizador comum", async () => {
    const { rawSentMessage, result } = evolutionSent("3EB0C4A72C3DE1925708C6");
    sendContent.mockResolvedValue(result);

    await SendWhatsAppMedia({
      media: imageMedia(),
      ticket: ticketRow() as never,
      body: ""
    });

    expect(createMessage).toHaveBeenCalledTimes(1);
    const payload = createMessage.mock.calls[0][0].messageData;
    expect(payload.id).toBe("3EB0C4A72C3DE1925708C6");
    expect(payload.externalMessageId).toBe("3EB0C4A72C3DE1925708C6");
    expect(payload.mediaType).toBe("image");
    expect(payload.mediaUrl).toBe("1710000000000_foto.jpg");
    expect(payload.ack).toBe(STREAMHUB_ACK.PENDING);
    expect(payload.ack).toBe(1);
    expect(typeof payload.ack).toBe("number");
    expect(payload.ack).not.toBe("PENDING");
    expect(payload.fromMe).toBe(true);
    expect(payload.dataJson).toBe(
      buildEvolutionOutboundDataJsonFromEnvelope(rawSentMessage)
    );
    expect(scheduleReapply).toHaveBeenCalledWith(
      expect.objectContaining({
        providerMessageId: "3EB0C4A72C3DE1925708C6"
      })
    );
    expect(incrementStorage).toHaveBeenCalledWith(1, 1024);
    expect(execMock).not.toHaveBeenCalled();
  });

  it("Baileys não persiste neste serviço (eco inbound)", async () => {
    mockBaileysOutbound();
    sendContent.mockResolvedValue({
      messageId: "BAILEYS1",
      status: 1,
      rawSentMessage: {
        key: { id: "BAILEYS1", remoteJid: "5511@s.whatsapp.net", fromMe: true },
        status: 1
      }
    });

    await SendWhatsAppMedia({
      media: imageMedia(),
      ticket: ticketRow() as never
    });

    expect(createMessage).not.toHaveBeenCalled();
    expect(scheduleReapply).not.toHaveBeenCalled();
    expect(incrementStorage).toHaveBeenCalledWith(1, 1024);
  });
});

describe("SendWhatsAppMedia Evolution outbound PTT audio-record-site", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEvolutionOutbound();
    getRemoteJid.mockResolvedValue("5511999998888@s.whatsapp.net");
    createMessage.mockResolvedValue({ id: "3EB0B9DEB9C1487F17544C" });
    incrementStorage.mockResolvedValue(undefined);
    execMock.mockImplementation((_cmd: string, cb: (err: null) => void) =>
      cb(null)
    );
  });

  it("converte para OGG/Opus, envia PTT e persiste o arquivo final", async () => {
    const { result } = evolutionSent("3EB0B9DEB9C1487F17544C");
    sendContent.mockResolvedValue(result);
    const ticket = ticketRow();

    await SendWhatsAppMedia({
      media: siteVoiceMedia(),
      ticket: ticket as never,
      body: "audio-record-site-1788473642919.webm"
    });

    expect(execMock).toHaveBeenCalledTimes(1);
    const cmd = String(execMock.mock.calls[0][0]);
    expect(cmd).toContain("libopus");
    expect(cmd).toContain("-f ogg");
    expect(cmd).toMatch(/\.ogg/);
    expect(cmd).not.toContain("-f ipod");
    expect(unlinkSync).toHaveBeenCalledWith(siteVoiceMedia().path);

    expect(sendContent).toHaveBeenCalledTimes(1);
    const { content } = sendContent.mock.calls[0][0];
    expect(content.ptt).toBe(true);
    expect(content.mimetype).toBe("audio/ogg; codecs=opus");
    expect(Buffer.isBuffer(content.audio)).toBe(true);
    expect(content.audio.toString()).toBe("ogg-opus");
    expect(content.audio.toString()).not.toBe("img");

    expect(createMessage).toHaveBeenCalledTimes(1);
    const payload = createMessage.mock.calls[0][0].messageData;
    expect(payload.id).toBe("3EB0B9DEB9C1487F17544C");
    expect(payload.externalMessageId).toBe("3EB0B9DEB9C1487F17544C");
    expect(payload.mediaType).toBe("audio");
    expect(payload.mediaUrl).toMatch(/\.ogg$/);
    expect(payload.mediaUrl).not.toMatch(/\.webm$/);
    expect(payload.mediaUrl).not.toContain(
      "audio-record-site-1788473642919.webm"
    );
    expect(payload.body).toBe("Áudio");
    expect(payload.ack).toBe(1);
    expect(typeof payload.ack).toBe("number");
    expect(ticket.update).toHaveBeenCalledWith({ lastMessage: "Áudio" });
  });

  it("áudio de arquivo (não gravador) não vira PTT OGG nem body Áudio", async () => {
    const { result } = evolutionSent("AUDFILE1");
    sendContent.mockResolvedValue(result);
    createMessage.mockResolvedValue({ id: "AUDFILE1" });

    const ticket = ticketRow();
    await SendWhatsAppMedia({
      media: fileAudioMedia(),
      ticket: ticket as never,
      body: "nota de voz anexada"
    });

    const cmd = String(execMock.mock.calls[0][0]);
    expect(cmd).not.toContain("libopus");
    expect(cmd).not.toContain("-f ogg");
    const { content } = sendContent.mock.calls[0][0];
    expect(content.ptt).toBeUndefined();
    expect(content.mimetype).toBe("audio/mpeg");
    const payload = createMessage.mock.calls[0][0].messageData;
    expect(payload.body).toBe("nota de voz anexada");
    expect(payload.body).not.toBe("Áudio");
    expect(payload.mediaUrl).toMatch(/\.mp3$/);
  });
});

describe("SendWhatsAppMedia Baileys audio-record-site", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBaileysOutbound();
    getRemoteJid.mockResolvedValue("5511999998888@s.whatsapp.net");
    execMock.mockImplementation((_cmd: string, cb: (err: null) => void) =>
      cb(null)
    );
  });

  it("mantém conversão AAC/MP4 e ptt true sem persistir aqui", async () => {
    sendContent.mockResolvedValue({
      messageId: "BAILEYSPTT",
      status: 1,
      rawSentMessage: {
        key: {
          id: "BAILEYSPTT",
          remoteJid: "5511@s.whatsapp.net",
          fromMe: true
        },
        status: 1
      }
    });

    await SendWhatsAppMedia({
      media: siteVoiceMedia(),
      ticket: ticketRow() as never,
      body: "audio-record-site-1788473642919.webm"
    });

    expect(execMock).toHaveBeenCalledTimes(1);
    const cmd = String(execMock.mock.calls[0][0]);
    expect(cmd).toContain("-f ipod");
    expect(cmd).toMatch(/\.mp3/);
    expect(cmd).not.toContain("libopus");
    const { content } = sendContent.mock.calls[0][0];
    expect(content.ptt).toBe(true);
    expect(content.mimetype).toBe("audio/mp4");
    expect(content.audio.toString()).toBe("aac-mp4");
    expect(createMessage).not.toHaveBeenCalled();
    expect(unlinkSync).toHaveBeenCalledWith(siteVoiceMedia().path);
  });
});
