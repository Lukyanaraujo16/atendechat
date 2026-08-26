/* eslint-disable import/first */
jest.mock("../../../../../libs/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: jest.fn() })
  })
}));

import {
  EVOLUTION_PHASE5_CAPABILITIES,
  EvolutionProviderNotReadyError,
  assertEvolutionTransportNotAvailable,
  startEvolutionWhatsAppSessionPlaceholder
} from "../index";
import { EvolutionWhatsAppOutbound } from "../outbound/EvolutionWhatsAppOutbound";
import {
  ERR_WHATSAPP_PROVIDER_NOT_READY,
  throwEvolutionProviderNotReady
} from "../evolutionErrors";
import AppError from "../../../../../errors/AppError";

describe("Evolution foundation (Fases 5–8)", () => {
  it("capacidades: outbound + webhook + ack/read/presence on; QR off", () => {
    expect(EVOLUTION_PHASE5_CAPABILITIES.sendText).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.sendMedia).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.webhookInbound).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.ack).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.markAsRead).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.presence).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.connect).toBe(false);
  });

  it("outbound Evolution instancia com whatsappId (transporte HTTP)", () => {
    const outbound = new EvolutionWhatsAppOutbound(42);
    expect(outbound.provider).toBe("evolution");
    expect(outbound.getOwnUserJid()).toBe("evolution:42");
  });

  it("assertEvolutionTransportNotAvailable lança erro tipado", () => {
    expect(() => assertEvolutionTransportNotAvailable()).toThrow(
      EvolutionProviderNotReadyError
    );
  });

  it("throwEvolutionProviderNotReady usa AppError 503", () => {
    try {
      throwEvolutionProviderNotReady();
      fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(503);
    }
  });

  it("placeholder de sessão não chama transporte e normaliza OPENING", async () => {
    const whatsapp = {
      id: 3,
      companyId: 1,
      status: "OPENING",
      update: jest.fn().mockResolvedValue(undefined)
    };
    await startEvolutionWhatsAppSessionPlaceholder(whatsapp as never, 1);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "DISCONNECTED" });
  });
});
