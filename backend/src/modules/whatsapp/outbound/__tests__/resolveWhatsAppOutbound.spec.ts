/* eslint-disable import/first */
jest.mock("../../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../../helpers/GetWhatsappWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("@whiskeysockets/baileys", () => ({
  proto: {},
  jidNormalizedUser: (jid: string) => jid
}));

import GetTicketWbot from "../../../../helpers/GetTicketWbot";
import GetWhatsappWbot from "../../../../helpers/GetWhatsappWbot";
import {
  getWhatsAppOutboundForTicket,
  getWhatsAppOutboundForWhatsapp,
  wrapBaileysSession
} from "../resolveWhatsAppOutbound";

const mockedTicketWbot = GetTicketWbot as jest.Mock;
const mockedWhatsappWbot = GetWhatsappWbot as jest.Mock;

describe("resolveWhatsAppOutbound", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolve por ticket a sessão Baileys da conexão do ticket", async () => {
    const wbot = {
      id: 7,
      user: { id: "5511:1@s.whatsapp.net" },
      sendMessage: jest.fn()
    };
    mockedTicketWbot.mockResolvedValue(wbot);

    const outbound = await getWhatsAppOutboundForTicket({
      whatsappId: 7,
      companyId: 1
    } as never);

    expect(mockedTicketWbot).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappId: 7 })
    );
    expect(outbound.provider).toBe("baileys");
    expect(outbound.getOwnUserJid()).toBe("5511:1@s.whatsapp.net");
  });

  it("resolve por Whatsapp a sessão da mesma conexão", async () => {
    const wbot = {
      id: 9,
      user: { id: "5511888:1@s.whatsapp.net" },
      sendMessage: jest.fn()
    };
    mockedWhatsappWbot.mockResolvedValue(wbot);

    const outbound = await getWhatsAppOutboundForWhatsapp({ id: 9 } as never);
    expect(mockedWhatsappWbot).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9 })
    );
    expect(outbound.provider).toBe("baileys");
    expect(outbound.getOwnUserJid()).toBe("5511888:1@s.whatsapp.net");
  });

  it("wrapBaileysSession encapsula socket já obtido (Typebot/inbound)", async () => {
    const wbot = {
      user: { id: "x" },
      sendMessage: jest.fn().mockResolvedValue({
        key: { id: "T1", remoteJid: "jid", fromMe: true }
      })
    };
    const outbound = wrapBaileysSession(wbot as never);
    const sent = await outbound.sendText({ jid: "jid", text: "oi" });
    expect(sent.messageId).toBe("T1");
    expect(wbot.sendMessage).toHaveBeenCalled();
  });
});
