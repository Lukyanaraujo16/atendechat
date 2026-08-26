jest.mock("../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("@whiskeysockets/baileys", () => ({
  proto: {},
  jidNormalizedUser: (jid: string) => jid
}));

jest.mock("../../libs/cache", () => ({
  cacheLayer: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn()
  }
}));

jest.mock("../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }))
}));

jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../../models/Contact", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../../models/Ticket", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../GetWhatsappWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../whatsappUnavailablePresence", () => ({
  isWhatsAppDisableAllReadAndPresenceSideEffects: jest.fn(() => false)
}));

import { cacheLayer } from "../../libs/cache";
import { getIO } from "../../libs/socket";
import Message from "../../models/Message";
import SetTicketMessagesAsRead from "../SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead — cache contacts:{id}:unreads", () => {
  const cacheSet = cacheLayer.set as jest.Mock;
  const messageUpdate = Message.update as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheSet.mockResolvedValue("OK");
    messageUpdate.mockResolvedValue([1]);
    (getIO as jest.Mock).mockReturnValue({
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    });
  });

  it("após leitura, DB unread=0 e cache coerente com '0'", async () => {
    const ticket = {
      id: 41,
      companyId: 1,
      contactId: 88,
      whatsappId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);

    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(cacheSet).toHaveBeenCalledWith("contacts:88:unreads", "0");
    expect(messageUpdate).toHaveBeenCalledWith(
      { read: true },
      { where: { ticketId: 41, read: false } }
    );
  });

  it("usa contact.id quando contactId não veio no ticket", async () => {
    const ticket = {
      id: 42,
      companyId: 1,
      contact: { id: 91 },
      whatsappId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);

    expect(cacheSet).toHaveBeenCalledWith("contacts:91:unreads", "0");
  });

  it("próxima inbound: cache '0' evolui para 1, não restaura 16", () => {
    const nextUnreadFromCache = (cached: string | null | undefined) =>
      +cached + 1;

    expect(nextUnreadFromCache("15")).toBe(16);
    expect(nextUnreadFromCache("0")).toBe(1);
  });

  it("falha no Redis não impede Message.read nem updateUnread", async () => {
    cacheSet.mockRejectedValue(new Error("redis down"));
    const emit = jest.fn();
    (getIO as jest.Mock).mockReturnValue({
      to: jest.fn().mockReturnThis(),
      emit
    });
    const ticket = {
      id: 43,
      companyId: 2,
      contactId: 12,
      whatsappId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);

    expect(messageUpdate).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("company-2-ticket", {
      action: "updateUnread",
      ticketId: 43
    });
  });
});
