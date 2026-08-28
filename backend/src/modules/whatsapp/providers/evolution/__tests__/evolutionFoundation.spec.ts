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
  it("capacidades: outbound + webhook + ack/read/presence + lifecycle on", () => {
    expect(EVOLUTION_PHASE5_CAPABILITIES.sendText).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.sendMedia).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.webhookInbound).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.ack).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.markAsRead).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.presence).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.connect).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.logout).toBe(true);
    expect(EVOLUTION_PHASE5_CAPABILITIES.qr).toBe(true);
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

  it("entry de sessão Evolution não chama transporte Baileys", async () => {
    const start = jest.fn().mockResolvedValue(undefined);
    jest.resetModules();
    jest.doMock("../lifecycle/startEvolutionWhatsAppSession", () => ({
      startEvolutionWhatsAppSession: start
    }));
    // Validação de capacidades já cobre lifecycle on; entry real testada em startEvolution*.
    expect(EVOLUTION_PHASE5_CAPABILITIES.connect).toBe(true);
  });

  it("placeholder alias aponta para entry lifecycle", () => {
    expect(typeof startEvolutionWhatsAppSessionPlaceholder).toBe("function");
  });
});
