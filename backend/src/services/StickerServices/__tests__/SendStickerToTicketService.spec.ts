/* eslint-disable import/first */
const sendContent = jest.fn();
const createMessage = jest.fn();
const findSticker = jest.fn();
const showTicket = jest.fn();
const getRemoteJid = jest.fn();
const getOutbound = jest.fn();
const existsSync = jest.fn((_p?: string) => true);
const readFileSync = jest.fn((_p?: string) => Buffer.from("webp-bytes"));

jest.mock("../../../models/Sticker", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findSticker(...a)
  }
}));

jest.mock("../../TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => showTicket(...a)
}));

jest.mock("../../../helpers/ticketAccess", () => ({
  assertUserCanAccessTicketResource: jest.fn().mockResolvedValue(undefined),
  toTicketAccessPayload: (t: unknown) => t
}));

jest.mock("../../../helpers/SetTicketMessagesAsRead", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
  HUMAN_PANEL_SEND_MESSAGE: "human_panel"
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: (...a: unknown[]) => getRemoteJid(...a)
}));

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: (...a: unknown[]) => getOutbound(...a)
}));

jest.mock("../../MessageServices/CreateMessageService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => createMessage(...a),
  serializeMessageForClient: (m: unknown) => m
}));

jest.mock("../../../helpers/stickerStorage", () => ({
  resolveStickerAbsolutePath: (p: string) => `/abs/${p}`
}));

jest.mock("fs", () => ({
  existsSync: (p: string) => existsSync(p),
  readFileSync: (p: string) => readFileSync(p)
}));

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (j: string) => j
}));

import SendStickerToTicketService from "../SendStickerToTicketService";

const STICKER_PATH = "stickers/company-1/1788619701305_1024.webp";

function stickerRow() {
  return {
    id: 7,
    companyId: 1,
    isActive: true,
    name: "streamhub",
    filePath: STICKER_PATH
  };
}

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

function actor() {
  return { id: 1, profile: "admin" };
}

describe("SendStickerToTicketService outbound body", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(Buffer.from("webp-bytes"));
    findSticker.mockResolvedValue(stickerRow());
    showTicket.mockResolvedValue(ticketRow());
    getRemoteJid.mockResolvedValue("5511999998888@s.whatsapp.net");
    createMessage.mockImplementation(
      async ({ messageData }: { messageData: { id: string } }) => ({
        ...messageData,
        companyId: 1
      })
    );
  });

  it("Evolution: persiste body sticker e não o nome da biblioteca", async () => {
    getOutbound.mockResolvedValue({
      provider: "evolution",
      getOwnUserJid: () => "evolution:3",
      sendContent: (...a: unknown[]) => sendContent(...a)
    });
    sendContent.mockResolvedValue({
      messageId: "3EB070435C31AF67E943A0",
      status: 1,
      rawSentMessage: {
        provider: "evolution",
        key: {
          id: "3EB070435C31AF67E943A0",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: true
        },
        status: 1
      }
    });

    const ticket = ticketRow();
    showTicket.mockResolvedValue(ticket);

    await SendStickerToTicketService({
      stickerId: 7,
      ticketId: 3,
      companyId: 1,
      actor: actor()
    });

    expect(sendContent).toHaveBeenCalledTimes(1);
    const sendArg = sendContent.mock.calls[0][0];
    expect(Buffer.isBuffer(sendArg.content.sticker)).toBe(true);
    expect(sendArg.content.sticker.toString()).toBe("webp-bytes");
    expect(sendArg.content.notConvertSticker).toBeUndefined();

    expect(createMessage).toHaveBeenCalledTimes(1);
    const payload = createMessage.mock.calls[0][0].messageData;
    expect(payload.id).toBe("3EB070435C31AF67E943A0");
    expect(payload.mediaType).toBe("sticker");
    expect(payload.mediaUrl).toBe(STICKER_PATH);
    expect(payload.body).toBe("sticker");
    expect(payload.body).not.toBe("streamhub");
    expect(payload.body).not.toBe(stickerRow().name);
    expect(payload.fromMe).toBe(true);
    expect(ticket.update).toHaveBeenCalledWith({ lastMessage: "sticker" });
  });

  it("Baileys: envia o WebP e persiste o mesmo placeholder sticker", async () => {
    getOutbound.mockResolvedValue({
      provider: "baileys",
      getOwnUserJid: () => "5511888887777@s.whatsapp.net",
      sendContent: (...a: unknown[]) => sendContent(...a)
    });
    sendContent.mockResolvedValue({
      messageId: "BAILEYSSTK1",
      status: 1,
      rawSentMessage: {
        key: {
          id: "BAILEYSSTK1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: true
        },
        status: 1
      }
    });

    await SendStickerToTicketService({
      stickerId: 7,
      ticketId: 3,
      companyId: 1,
      actor: actor()
    });

    expect(sendContent).toHaveBeenCalledTimes(1);
    expect(sendContent.mock.calls[0][0].content.sticker.toString()).toBe(
      "webp-bytes"
    );
    expect(
      sendContent.mock.calls[0][0].content.notConvertSticker
    ).toBeUndefined();
    expect(createMessage).toHaveBeenCalledTimes(1);
    const payload = createMessage.mock.calls[0][0].messageData;
    expect(payload.id).toBe("BAILEYSSTK1");
    expect(payload.mediaType).toBe("sticker");
    expect(payload.mediaUrl).toBe(STICKER_PATH);
    expect(payload.body).toBe("sticker");
    expect(payload.body).not.toBe("streamhub");
  });
});
