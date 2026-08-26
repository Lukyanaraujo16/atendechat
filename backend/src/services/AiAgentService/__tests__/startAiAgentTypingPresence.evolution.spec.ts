/* eslint-disable import/first */
/**
 * AI Agent typing → WhatsAppOutbound Evolution (sem GetTicketWbot).
 */
const getOutbound = jest.fn();
const sendPresence = jest.fn();

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: (...a: unknown[]) => getOutbound(...a)
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: jest.fn().mockResolvedValue("5511999998888@s.whatsapp.net")
}));

jest.mock("../../../helpers/whatsappUnavailablePresence", () => ({
  isWhatsAppDisableAllReadAndPresenceSideEffects: () => false
}));

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (j: string) => j
}));

import { startAiAgentTypingPresence } from "../startAiAgentTypingPresence";

describe("startAiAgentTypingPresence Evolution Fase 9A", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendPresence.mockResolvedValue(true);
    getOutbound.mockResolvedValue({
      provider: "evolution",
      sendPresence
    });
  });

  it("usa getWhatsAppOutboundForTicket e envia composing (sem GetTicketWbot)", async () => {
    const timers = {
      setInterval: jest.fn().mockReturnValue({ unref: jest.fn() }),
      clearInterval: jest.fn(),
      setTimeout: jest.fn().mockReturnValue({ unref: jest.fn() }),
      clearTimeout: jest.fn()
    };

    const handle = await startAiAgentTypingPresence({
      ticket: {
        id: 1,
        contactId: 2,
        companyId: 1,
        whatsappId: 10,
        isGroup: false
      } as never,
      whatsapp: { id: 10 } as never,
      companyId: 1,
      executionId: "exec-1",
      timers: timers as never
    });

    expect(getOutbound).toHaveBeenCalled();
    expect(sendPresence).toHaveBeenCalledWith(
      expect.objectContaining({
        presence: "composing",
        subscribe: true
      })
    );
    expect(handle.started).toBe(true);
    await handle.stop("test");
    expect(sendPresence).toHaveBeenCalledWith(
      expect.objectContaining({ presence: "paused" })
    );
  });
});
