/* eslint-disable import/first */
jest.mock("../../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../../helpers/GetWhatsappWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../../helpers/GetDefaultWhatsApp", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));
jest.mock("@whiskeysockets/baileys", () => ({
  proto: {},
  jidNormalizedUser: (jid: string) => jid
}));

import GetTicketWbot from "../../../../helpers/GetTicketWbot";
import GetWhatsappWbot from "../../../../helpers/GetWhatsappWbot";
import Whatsapp from "../../../../models/Whatsapp";
import {
  getWhatsAppOutboundForTicket,
  getWhatsAppOutboundForWhatsapp,
  wrapBaileysSession
} from "../resolveWhatsAppOutbound";

const mockedTicketWbot = GetTicketWbot as jest.Mock;
const mockedWhatsappWbot = GetWhatsappWbot as jest.Mock;
const mockedFindByPk = Whatsapp.findByPk as jest.Mock;

describe("resolveWhatsAppOutbound", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Baileys resolve BaileysWhatsAppOutbound sem Evolution", async () => {
    const wbot = {
      id: 9,
      user: { id: "5511888:1@s.whatsapp.net" },
      sendMessage: jest.fn()
    };
    mockedWhatsappWbot.mockResolvedValue(wbot);

    const outbound = await getWhatsAppOutboundForWhatsapp({
      id: 9,
      connectionProvider: "baileys"
    } as never);
    expect(mockedWhatsappWbot).toHaveBeenCalled();
    expect(outbound.provider).toBe("baileys");
  });

  it("Evolution resolve EvolutionWhatsAppOutbound sem GetWhatsappWbot", async () => {
    const outbound = await getWhatsAppOutboundForWhatsapp({
      id: 99,
      connectionProvider: "evolution"
    } as never);
    expect(outbound.provider).toBe("evolution");
    expect(mockedWhatsappWbot).not.toHaveBeenCalled();
    expect(mockedTicketWbot).not.toHaveBeenCalled();
  });

  it("Evolution por ticket NÃO chama GetTicketWbot", async () => {
    mockedFindByPk.mockResolvedValue({
      id: 77,
      connectionProvider: "evolution"
    });

    const outbound = await getWhatsAppOutboundForTicket({
      whatsappId: 77,
      companyId: 1
    } as never);

    expect(outbound.provider).toBe("evolution");
    expect(mockedTicketWbot).not.toHaveBeenCalled();
    expect(mockedWhatsappWbot).not.toHaveBeenCalled();
  });

  it("resolve por ticket Baileys usa helpers após checagem de provider", async () => {
    mockedFindByPk.mockResolvedValue({
      id: 7,
      connectionProvider: "baileys"
    });
    const wbot = {
      id: 7,
      user: { id: "5511:1@s.whatsapp.net" },
      sendMessage: jest.fn()
    };
    mockedWhatsappWbot.mockResolvedValue(wbot);

    const outbound = await getWhatsAppOutboundForTicket({
      whatsappId: 7,
      companyId: 1
    } as never);

    expect(mockedFindByPk).toHaveBeenCalledWith(7);
    expect(mockedWhatsappWbot).toHaveBeenCalled();
    expect(mockedTicketWbot).not.toHaveBeenCalled();
    expect(outbound.provider).toBe("baileys");
  });

  it("wrapBaileysSession encapsula socket já obtido", async () => {
    const wbot = {
      user: { id: "x" },
      sendMessage: jest.fn().mockResolvedValue({
        key: { id: "T1", remoteJid: "jid", fromMe: true }
      })
    };
    const outbound = wrapBaileysSession(wbot as never);
    const sent = await outbound.sendText({ jid: "jid", text: "oi" });
    expect(sent.messageId).toBe("T1");
  });
});
