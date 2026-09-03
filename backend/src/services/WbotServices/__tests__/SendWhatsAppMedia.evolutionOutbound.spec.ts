/* eslint-disable import/first */
const sendContent = jest.fn();
const createMessage = jest.fn();
const incrementStorage = jest.fn();
const scheduleReapply = jest.fn();
const getRemoteJid = jest.fn();

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: jest.fn(async () => ({
    getOwnUserJid: () => "evolution:3",
    sendContent: (...a: unknown[]) => sendContent(...a)
  }))
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

jest.mock("fs", () => ({
  readFileSync: jest.fn(() => Buffer.from("img")),
  unlinkSync: jest.fn()
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

describe("SendWhatsAppMedia Evolution outbound persist", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRemoteJid.mockResolvedValue("5511999998888@s.whatsapp.net");
    createMessage.mockResolvedValue({ id: "3EB0C4A72C3DE1925708C6" });
    incrementStorage.mockResolvedValue(undefined);
  });

  it("persiste mídia Evolution com ack numérico, mediaUrl e normalizador comum", async () => {
    const rawSentMessage = {
      provider: "evolution",
      key: {
        id: "3EB0C4A72C3DE1925708C6",
        remoteJid: "5511999998888@s.whatsapp.net",
        fromMe: true
      },
      status: STREAMHUB_ACK.PENDING,
      providerStatus: "PENDING"
    };
    sendContent.mockResolvedValue({
      messageId: "3EB0C4A72C3DE1925708C6",
      status: STREAMHUB_ACK.PENDING,
      rawSentMessage
    });

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
  });

  it("Baileys não persiste neste serviço (eco inbound)", async () => {
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
